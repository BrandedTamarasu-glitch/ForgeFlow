#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildEfficiencyGapPlan, parseArgs, renderMarkdown } = require('./render-efficiency-gap-plan');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-efficiency-gap-plan-'));
const home = path.join(root, 'home');
const metricsRoot = path.join(home, '.claude', 'projects');
const patternsDir = path.join(root, 'forgeflow-patterns');
const projectDir = path.join(root, '.forgeflow', path.basename(root));
const contextDir = path.join(projectDir, 'context');
fs.mkdirSync(path.join(metricsRoot, 'demo', 'memory'), { recursive: true });
fs.mkdirSync(patternsDir, { recursive: true });
fs.mkdirSync(path.join(contextDir, 'latest'), { recursive: true });

spawnSync('git', ['init'], { cwd: root, encoding: 'utf8' });
fs.writeFileSync(path.join(root, 'README.md'), '# Demo\n');
spawnSync('git', ['add', 'README.md'], { cwd: root, encoding: 'utf8' });
spawnSync('git', ['commit', '-m', 'init'], { cwd: root, encoding: 'utf8' });
const commitShort = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();

fs.writeFileSync(path.join(contextDir, 'project-intelligence-rollup.json'), JSON.stringify({
  readiness: { state: 'ready' },
  freshness: { failure_digest: 'not-applicable' },
  artifacts: { failure_digest: null },
  hot_files: [
    'scripts/forgeflow/install-manifest.js (3 signals)',
    'scripts/forgeflow/health-check.js (2 signals)',
  ],
  next_work_confidence: { status: 'missing' },
  review_outcomes: { status: 'missing' },
  agent_feedback: { status: 'missing' },
  user_profile: { status: 'warn', suggestion_count: 4 },
  next_work_items: [],
}, null, 2));
fs.writeFileSync(path.join(contextDir, 'context-telemetry.json'), JSON.stringify({
  estimated_compact_tokens: 2000,
  estimated_saved_tokens: 8000,
}) + '\n');
fs.writeFileSync(path.join(contextDir, 'code-map-history.jsonl'), [
  JSON.stringify({
    schema_version: '1',
    generated_at: '2026-05-01T00:00:00Z',
    commit_short: commitShort,
    dirty: false,
    summary: { source_files: 1, local_edges: 0, unresolved_imports: 0, skipped_dynamic_imports: 0, sections: 1, changed_sections: 0, markdown_section_files: 1 },
    high_fan_in: [],
    high_fan_out: [],
  }),
  '',
].join('\n'));
fs.writeFileSync(path.join(contextDir, 'code-topology.json'), JSON.stringify({ schema_version: '1', unresolved: [], skipped_dynamic: [] }, null, 2));
fs.writeFileSync(path.join(projectDir, 'project-learnings.md'), [
  '# Project Learnings',
  '',
  'Project learnings are guidance only. Verify current findings against current code, tests, and artifacts.',
  '',
].join('\n'));
fs.writeFileSync(path.join(contextDir, 'latest', 'latest-insights-report.json'), JSON.stringify({
  schema_version: '1',
  status: 'injected',
  reason: 'quality-check-passing',
  generated_at: '2026-05-01T00:00:00Z',
  git: { available: true, commit_short: commitShort, dirty: false },
  check_status: 'pass',
  issue_count: 0,
}, null, 2));
fs.writeFileSync(path.join(metricsRoot, 'demo', 'memory', 'forgeflow-metrics.jsonl'), '');
fs.writeFileSync(path.join(patternsDir, '.learnings-log.jsonl'), '');

const result = buildEfficiencyGapPlan({
  root,
  projectDir,
  metricsRoot,
  patternsDir,
  failedCommand: 'npm test',
});
const markdown = renderMarkdown(result);
const opts = parseArgs([
  '--root',
  root,
  '--project-dir',
  projectDir,
  '--metrics-root',
  metricsRoot,
  '--patterns-dir',
  patternsDir,
  '--failed-command',
  'npm test',
  '--json',
]);
const rawOpts = parseArgs(['--root', root, '--args', '--failed-command "npm run test:unit" --json']);

function hasGap(id) {
  return result.gaps.some((item) => item.id === id);
}

const checks = [
  ['builds five phases', result.status === 'planned' && result.gap_count === 5],
  ['considers candidate pool', result.candidate_count >= result.gap_count],
  ['includes outcome gap', hasGap('outcome-calibration') && result.gaps.find((item) => item.id === 'outcome-calibration').evidence.missing_streams === 3],
  ['includes profile guardrail', hasGap('user-profile') && markdown.includes('Do not infer preferences')],
  ['includes runtime inventory hotspot', hasGap('runtime-inventory') && markdown.includes('runtime-inventory.js')],
  ['includes failure capture preview', hasGap('failure-digest') && result.gaps.find((item) => item.id === 'failure-digest').evidence.capture_preview.mode === 'test'],
  ['includes telemetry thin signal', hasGap('forgeflow-telemetry') && result.gaps.find((item) => item.id === 'forgeflow-telemetry').evidence.verdict_reviewers === 0],
  ['renders evidence and validation', markdown.includes('Evidence:') && markdown.includes('- Validate:')],
  ['renders read-only boundary', markdown.includes('does not record outcomes') && markdown.includes('automates local gap discovery') && markdown.includes('execute failed commands')],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.metricsRoot === metricsRoot && opts.patternsDir === patternsDir && opts.failedCommand === 'npm test' && opts.json === true],
  ['parses quoted raw args', rawOpts.root === root && rawOpts.failedCommand === 'npm run test:unit' && rawOpts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('efficiency gap plan: ok');
