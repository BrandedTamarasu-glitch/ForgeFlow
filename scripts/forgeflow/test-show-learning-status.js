#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildLearningStatus, parseArgs, renderMarkdown } = require('./show-learning-status');
const { recordFirstRunResult } = require('./record-first-run-result');
const { recordNextWorkOutcome } = require('./record-next-work-outcome');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-learning-status-'));
const projectDir = path.join(root, '.forgeflow', path.basename(root));
const contextDir = path.join(projectDir, 'context');
fs.mkdirSync(contextDir, { recursive: true });
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
recordNextWorkOutcome({ projectDir, title: 'release verify planning', source: 'release', outcome: 'incorrect', confidence: 'high' });
recordNextWorkOutcome({ projectDir, title: 'health status check', source: 'health', outcome: 'useful', confidence: 'high' });
recordFirstRunResult({ projectDir, runtime: 'codex', health: 'fail', smoke: 'pass', profile: 'pass', decision: 'fix-first', friction: 'health' });
fs.writeFileSync(path.join(contextDir, 'project-operating-model.json'), JSON.stringify({
  schema_version: '1',
  status: 'ready',
  generated_at: '2026-05-20T00:00:00Z',
}, null, 2));
fs.writeFileSync(path.join(contextDir, 'operating-model-history.jsonl'), `${JSON.stringify({
  schema_version: '1',
  generated_at: '2026-05-20T00:00:00Z',
  domains: ['scripts/forgeflow'],
  high_care_files: ['scripts/forgeflow/file-safety.js'],
  risk_zones: [],
  validation_patterns: ['node scripts/forgeflow/test-show-learning-status.js'],
})}\n`);

const result = buildLearningStatus({ root, projectDir });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--json']);
const checks = [
  ['schema version', result.schema_version === '1'],
  ['summarizes all sections', result.sections.length === 7 && result.sections.some((item) => item.name === 'first-run-results') && result.sections.some((item) => item.name === 'project-operating-model')],
  ['overall attention or fail', ['attention', 'fail'].includes(result.status)],
  ['recommendations include corrective signals', result.recommendations.some((item) => item.action === 'triage-review-outcome-learning-signals') && result.recommendations.some((item) => item.action === 'calibrate-next-work-selection') && result.recommendations.some((item) => item.action === 'fix-first-run-friction')],
  ['groups recommendations', result.recommendation_groups.fix_first.some((item) => item.source === 'first-run-results') && result.recommendation_groups.watch.some((item) => item.source === 'agent-feedback')],
  ['operating model signal present', result.sections.some((item) => item.name === 'project-operating-model' && item.status === 'present' && item.records === 1 && item.next === 'continue-using-operating-model')],
  ['operating model signal uses history timestamp for decay', result.signal_quality.signals.some((item) => item.source === 'project-operating-model' && item.decay.age_days !== null && !item.notes.includes('no-timestamped-artifact'))],
  ['signal quality present', result.signal_quality.status === 'attention' && result.signal_quality.signals.some((item) => item.source === 'next-work-outcomes' && item.notes.includes('corrective-heavy')) && result.signal_quality.signals.some((item) => item.source === 'project-operating-model')],
  ['signal quality rollup present', Array.isArray(result.signal_quality.trusted_sources) && result.signal_quality.weakest_sources.length > 0 && result.signal_quality.next_quality_action.includes(result.signal_quality.weakest_sources[0])],
  ['outcome capture plan present', result.outcome_capture_plan.status === 'has-outcomes' && result.outcome_capture_plan.streams.every((item) => item.action === 'watch') && result.outcome_capture_plan.next_after_action.includes('Keep recording')],
  ['workflow ending capture present', result.workflow_ending_capture.length === 3 && result.workflow_ending_capture.every((item) => item.status === 'watch')],
  ['signal decay present', result.signal_quality.signals.every((item) => item.decay && Number.isFinite(item.decay.penalty))],
  ['markdown renders', markdown.includes('# Forgeflow Learning Status') && markdown.includes('## Signals') && markdown.includes('## Fix First') && markdown.includes('## Watch') && markdown.includes('## Healthy') && markdown.includes('## Signal Quality') && markdown.includes('Next quality action') && markdown.includes('## Outcome Capture') && markdown.includes('## Workflow Ending Capture') && markdown.includes('Next after action:') && markdown.includes('Decay:') && markdown.includes('first-run-results') && markdown.includes('project-operating-model') && markdown.includes('advisory local evidence')],
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
