#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildOutcomeCapturePlan, parseArgs, renderMarkdown } = require('./render-outcome-capture-plan');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-outcome-capture-plan-'));
const projectDir = path.join(root, '.forgeflow', path.basename(root));
const contextDir = path.join(projectDir, 'context');
fs.mkdirSync(contextDir, { recursive: true });
fs.writeFileSync(path.join(contextDir, 'project-intelligence-rollup.json'), JSON.stringify({
  next_work_confidence: { status: 'missing' },
  review_outcomes: { status: 'missing' },
  agent_feedback: { status: 'ok' },
}, null, 2));

const result = buildOutcomeCapturePlan({ root, projectDir });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--json']);
const fallbackRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-outcome-capture-fallback-'));
const fallbackProjectDir = path.join(fallbackRoot, '.forgeflow', path.basename(fallbackRoot));
const fallbackContextDir = path.join(fallbackProjectDir, 'context');
fs.mkdirSync(fallbackProjectDir, { recursive: true });
fs.mkdirSync(fallbackContextDir, { recursive: true });
fs.writeFileSync(path.join(fallbackContextDir, 'project-intelligence-rollup.json'), JSON.stringify({
  agent_feedback: { status: 'missing' },
}, null, 2));
fs.writeFileSync(path.join(fallbackProjectDir, 'agent-feedback.jsonl'), `${JSON.stringify({
  schema_version: '1',
  agent: 'smith',
  signal: 'useful',
  summary: 'Helped confirm validation.',
  confidence: 'medium',
  evidence_count: 1,
})}\n`);
const fallback = buildOutcomeCapturePlan({ root: fallbackRoot, projectDir: fallbackProjectDir });
const emptyOverrideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-outcome-capture-empty-'));
const emptyOverrideProjectDir = path.join(emptyOverrideRoot, '.forgeflow', path.basename(emptyOverrideRoot));
const emptyOverrideContextDir = path.join(emptyOverrideProjectDir, 'context');
fs.mkdirSync(emptyOverrideContextDir, { recursive: true });
fs.writeFileSync(path.join(emptyOverrideContextDir, 'project-intelligence-rollup.json'), JSON.stringify({
  next_work_confidence: { status: 'present' },
}, null, 2));
fs.writeFileSync(path.join(emptyOverrideProjectDir, 'next-work-outcomes.jsonl'), '');
const emptyOverride = buildOutcomeCapturePlan({ root: emptyOverrideRoot, projectDir: emptyOverrideProjectDir });
const missingOverrideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-outcome-capture-missing-'));
const missingOverrideProjectDir = path.join(missingOverrideRoot, '.forgeflow', path.basename(missingOverrideRoot));
const missingOverrideContextDir = path.join(missingOverrideProjectDir, 'context');
fs.mkdirSync(missingOverrideContextDir, { recursive: true });
fs.writeFileSync(path.join(missingOverrideContextDir, 'project-intelligence-rollup.json'), JSON.stringify({
  review_outcomes: { status: 'present' },
}, null, 2));
const missingOverride = buildOutcomeCapturePlan({ root: missingOverrideRoot, projectDir: missingOverrideProjectDir });
const invalidRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-outcome-capture-invalid-'));
const invalidProjectDir = path.join(invalidRoot, '.forgeflow', path.basename(invalidRoot));
fs.mkdirSync(invalidProjectDir, { recursive: true });
fs.writeFileSync(path.join(invalidProjectDir, 'review-outcomes.jsonl'), '{bad json}\n');
const invalid = buildOutcomeCapturePlan({ root: invalidRoot, projectDir: invalidProjectDir });

const checks = [
  ['reports missing streams', result.status === 'capture-needed' && result.missing_count === 3],
  ['stale intelligence without local evidence still prompts capture', result.streams.find((item) => item.name === 'agent-feedback').action === 'capture-next'],
  ['adds after-action prompts', result.next_after_action.includes('recommended next item') && result.streams.every((item) => item.after_action_prompt)],
  ['adds capture runbooks', result.capture_runbook.status === 'needs-observed-outcome' && result.capture_runbook.requires_observed_values === true && result.streams.every((item) => item.capture_runbook.do_not_record.includes('guessed outcomes'))],
  ['renders recorder prompts', markdown.includes('record-next-work-outcome') && markdown.includes('record-review-outcome')],
  ['renders after-action prompt', markdown.includes('Next after action:') && markdown.includes('After action:') && markdown.includes('## Capture Runbook')],
  ['renders boundary', markdown.includes('does not record')],
  ['falls back to local jsonl evidence', fallback.streams.find((item) => item.name === 'agent-feedback').action === 'watch' && fallback.missing_count === 2],
  ['empty local jsonl overrides stale present metadata', emptyOverride.streams.find((item) => item.name === 'next-work-outcomes').action === 'capture-next'],
  ['missing local jsonl overrides stale present metadata', missingOverride.streams.find((item) => item.name === 'review-outcomes').action === 'capture-next'],
  ['invalid local jsonl prompts capture', invalid.streams.find((item) => item.name === 'review-outcomes').status === 'invalid' && invalid.streams.find((item) => item.name === 'review-outcomes').action === 'capture-next'],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('outcome capture plan: ok');
