#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildLearningStatus, parseArgs, renderMarkdown } = require('./show-learning-status');
const { recordFirstRunResult } = require('./record-first-run-result');
const { recordNextWorkOutcome } = require('./record-next-work-outcome');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-learning-status-'));
const projectDir = path.join(root, '.forgeflow', path.basename(root));
fs.mkdirSync(projectDir, { recursive: true });
fs.writeFileSync(path.join(projectDir, 'project-learnings.md'), [
  '# Forgeflow Project Learnings',
  '',
  'Generated at: 2026-05-20T00:00:00Z',
  '',
  'Project learnings are guidance only. Verify every insight against current code, tests, review artifacts, and user intent before acting.',
  '',
  '## Stable Decisions',
  '- Use focused helper tests before full release checks.',
  '',
  '## Recurring Pitfalls',
  '- Missing release fixture updates can break post-publish verification.',
  '',
  '## Risk Areas',
  '- Release helpers need sandbox-aware messaging.',
  '',
  '## Validation Patterns',
  '- Run source smoke before tagging.',
  '',
  '## Recommended Approach For Next Work',
  '- Start with the smallest helper slice.',
  '',
].join('\n'));
fs.writeFileSync(path.join(projectDir, 'agent-feedback.jsonl'), `${JSON.stringify({
  schema_version: '1',
  agent: 'warden_reviewer',
  signal: 'incorrect',
  summary: 'Flagged stale release state',
  confidence: 'high',
  evidence_count: 1,
})}\n`);
fs.writeFileSync(path.join(projectDir, 'review-outcomes.jsonl'), `${JSON.stringify({
  schema_version: '1',
  change_id: 'learning-status',
  recorded_at: '2026-05-20T00:00:00Z',
  review: { mode: 'full-mode', workflow: 'forgeflow', agents_used: ['warden_reviewer'], verifier_decisions: [] },
  outcome: {
    findings_total: 1,
    findings_confirmed: 0,
    findings_rejected: 1,
    review_minutes: 3,
    auto_fix_success: true,
    post_merge_regression: false,
  },
})}\n`);
recordNextWorkOutcome({ projectDir, title: 'Review profile guidance', source: 'user-profile', outcome: 'blocked' });
recordFirstRunResult({ projectDir, runtime: 'codex', health: 'fail', smoke: 'pass', profile: 'pass', decision: 'fix-first', friction: 'health' });

const result = buildLearningStatus({ root, projectDir });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--json']);
const checks = [
  ['schema version', result.schema_version === '1'],
  ['summarizes all sections', result.sections.length === 6 && result.sections.some((item) => item.name === 'first-run-results')],
  ['overall attention or fail', ['attention', 'fail'].includes(result.status)],
  ['recommendations include corrective signals', result.recommendations.some((item) => item.action === 'triage-review-outcome-learning-signals') && result.recommendations.some((item) => item.action === 'calibrate-next-work-selection') && result.recommendations.some((item) => item.action === 'fix-first-run-friction')],
  ['groups recommendations', result.recommendation_groups.fix_first.some((item) => item.source === 'first-run-results') && result.recommendation_groups.watch.some((item) => item.source === 'agent-feedback')],
  ['markdown renders', markdown.includes('# Forgeflow Learning Status') && markdown.includes('## Signals') && markdown.includes('## Fix First') && markdown.includes('## Watch') && markdown.includes('## Healthy') && markdown.includes('first-run-results') && markdown.includes('advisory local evidence')],
  ['cli args parse', opts.root === root && opts.projectDir === projectDir && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('learning status: ok');
