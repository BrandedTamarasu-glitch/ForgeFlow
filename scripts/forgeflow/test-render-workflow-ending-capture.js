#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildWorkflowEndingCapture, nudgeEventFor, parseArgs, renderMarkdown } = require('./render-workflow-ending-capture');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-workflow-ending-capture-'));
const root = path.join(tmp, 'repo');
const projectDir = path.join(root, '.forgeflow', 'Demo');
fs.mkdirSync(projectDir, { recursive: true });

const review = buildWorkflowEndingCapture({ root, projectDir, event: 'review' });
const auto = buildWorkflowEndingCapture({ root, projectDir, event: 'auto' });
fs.writeFileSync(path.join(projectDir, 'review-outcomes.jsonl'), `${JSON.stringify({
  schema_version: '1',
  change_id: 'workflow-ending-capture',
  recorded_at: '2026-05-20T00:00:00Z',
  review: { mode: 'full-mode', workflow: 'forgeflow', agents_used: ['warden_reviewer'], verifier_decisions: [] },
  outcome: {
    findings_total: 1,
    findings_confirmed: 1,
    findings_rejected: 0,
    review_minutes: 3,
    auto_fix_success: true,
    post_merge_regression: false,
  },
})}\n`);
const watch = buildWorkflowEndingCapture({ root, projectDir, event: 'review' });
const invalidRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-workflow-ending-capture-invalid-'));
const invalidProjectDir = path.join(invalidRoot, '.forgeflow', 'Demo');
fs.mkdirSync(invalidProjectDir, { recursive: true });
fs.writeFileSync(path.join(invalidProjectDir, 'review-outcomes.jsonl'), '{bad json}\n');
const invalid = buildWorkflowEndingCapture({ root: invalidRoot, projectDir: invalidProjectDir, event: 'review' });
const markdown = renderMarkdown(review);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--event', 'agent-feedback', '--json']);
let invalidBlocked = false;
try {
  parseArgs(['--event', 'ship']);
} catch (err) {
  invalidBlocked = /Invalid --event/.test(err.message);
}

const checks = [
  ['recommends review capture', review.status === 'capture-recommended' && review.stream === 'review-outcomes' && review.command.includes('record-review-outcome')],
  ['adds evidence contract', review.evidence_contract.stream === 'review-outcomes' && review.evidence_contract.required_values.includes('findings confirmed') && review.evidence_contract.do_not_record.includes('guessed outcomes')],
  ['adds recorder learning nudge', review.learning_nudge.command.includes('record-review-outcome') && review.learning_nudge.stop_rule.includes('observed workflow outcomes')],
  ['watch nudge does not recurse', watch.learning_nudge.command === ''],
  ['maps auto nudge event', nudgeEventFor('auto', 'next-work-outcomes') === 'next-work'],
  ['auto chooses a missing stream', auto.status === 'capture-recommended' && auto.command.startsWith('record-')],
  ['watches present stream', watch.status === 'watch' && watch.command === ''],
  ['invalid stream still recommends capture', invalid.status === 'capture-recommended' && invalid.stream === 'review-outcomes'],
  ['renders boundary and command', markdown.includes('Workflow-ending capture is advisory') && markdown.includes('## Evidence Contract') && markdown.includes('## Learning Nudge') && markdown.includes('record-review-outcome')],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.event === 'agent-feedback' && opts.json === true],
  ['rejects invalid events', invalidBlocked],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('workflow ending capture: ok');
