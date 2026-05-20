#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  buildReport,
  collectMetrics,
  cutoffForPeriod,
  renderMarkdown,
  summarizePatternLog,
} = require('./render-forgeflow-report');

const repoRoot = path.resolve(__dirname, '..', '..');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-report-'));
const metricsRoot = path.join(root, 'metrics-root');
const patternsDir = path.join(root, 'forgeflow-patterns');
const projectDir = path.join(root, '.forgeflow', 'Demo');
const contextDir = path.join(projectDir, 'context');
fs.mkdirSync(path.join(metricsRoot, 'project-a', 'memory'), { recursive: true });
fs.mkdirSync(patternsDir, { recursive: true });
fs.mkdirSync(contextDir, { recursive: true });

spawnSync('git', ['init'], { cwd: root, encoding: 'utf8' });
fs.writeFileSync(path.join(root, 'README.md'), '# Demo\n');
spawnSync('git', ['add', 'README.md'], { cwd: root, encoding: 'utf8' });
spawnSync('git', ['commit', '-m', 'init'], { cwd: root, encoding: 'utf8' });
const commitShort = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();

const metricsFile = path.join(metricsRoot, 'project-a', 'memory', 'forgeflow-metrics.jsonl');
fs.writeFileSync(metricsFile, [
  JSON.stringify({ schema_version: '1', ts: '2026-05-10T10:00:00.000Z', project: 'Demo', event: 'verdict', command: '/review', detail: { reviewer: 'arbiter', verdict: 'APPROVE' } }),
  JSON.stringify({ schema_version: '1', ts: '2026-05-10T10:01:00.000Z', project: 'Demo', event: 'verdict', command: '/review', detail: { reviewer: 'compass', verdict: 'CONFIRM' } }),
  JSON.stringify({ schema_version: '1', ts: '2026-05-10T10:02:00.000Z', project: 'Demo', event: 'auto-fix-round', command: '/review-auto', detail: { round: 1 } }),
  JSON.stringify({ schema_version: '1', ts: '2026-05-10T10:03:00.000Z', project: 'Demo', event: 'auto-fix-applied', command: '/review-auto', detail: { success: true } }),
  JSON.stringify({ schema_version: '1', ts: '2026-05-10T10:04:00.000Z', project: 'Demo', event: 'fleet-shard-complete', command: '/fleet', detail: { shard: 1 } }),
  JSON.stringify({ schema_version: '1', ts: '2026-05-10T10:05:00.000Z', project: 'Demo', event: 'finding-overturned', command: '/review', detail: { overturned_reviewer: 'Smith', finding_class: 'n-plus-one', finding: 'batch loop was safe' } }),
  JSON.stringify({ schema_version: '1', ts: '2026-05-10T10:06:00.000Z', project: 'Demo', event: 'finding-overturned', command: '/review', detail: { overturned_reviewer: 'Smith', finding_class: 'n-plus-one', finding: 'batch loop was safe again' } }),
  JSON.stringify({ schema_version: '1', ts: '2026-05-10T10:07:00.000Z', project: 'Demo', event: 'finding-overturned', command: '/review', detail: { overturned_reviewer: 'Smith', finding_class: 'n-plus-one', finding: 'batch loop was still safe' } }),
  '',
].join('\n'));

fs.writeFileSync(path.join(patternsDir, '.learnings-log.jsonl'), [
  JSON.stringify({ ts: '2026-05-01T00:00:00.000Z', projects_scanned: 2, learnings_total: 5, updates_applied: 2, candidates: 1 }),
  '',
].join('\n'));
fs.writeFileSync(path.join(patternsDir, '.report-log.jsonl'), [
  JSON.stringify({ schema_version: '1', ts: '2026-05-01T00:00:00.000Z', period: 'month', total_invocations: 2, flagged_reviewers: 0, drifted_agents: 0 }),
  '',
].join('\n'));

fs.writeFileSync(path.join(contextDir, 'context-telemetry.json'), JSON.stringify({
  schema_version: '1',
  kind: 'context-pack',
  baseline_chars: 40000,
  compact_chars: 8000,
  saved_chars: 32000,
  estimated_baseline_tokens: 10000,
  estimated_compact_tokens: 2000,
  estimated_saved_tokens: 8000,
}) + '\n');
fs.writeFileSync(path.join(contextDir, 'code-map-history.jsonl'), [
  JSON.stringify({
    schema_version: '1',
    generated_at: '2026-05-09T00:00:00.000Z',
    commit_short: 'aaaaaaa',
    dirty: true,
    summary: { source_files: 2, local_edges: 1, unresolved_imports: 0, skipped_dynamic_imports: 0, sections: 5, changed_sections: 0, markdown_section_files: 1 },
    high_fan_in: [],
    high_fan_out: [],
  }),
  JSON.stringify({
    schema_version: '1',
    generated_at: '2026-05-10T00:00:00.000Z',
    commit_short: commitShort,
    dirty: true,
    summary: { source_files: 3, local_edges: 2, unresolved_imports: 1, skipped_dynamic_imports: 0, sections: 7, changed_sections: 2, markdown_section_files: 1 },
    high_fan_in: [{ path: 'src/core.ts', fan_in: 4, fan_out: 0 }],
    high_fan_out: [],
  }),
  '',
].join('\n'));
fs.writeFileSync(path.join(projectDir, 'project-learnings.md'), [
  '# Project Learnings',
  '',
  'Project learnings are guidance only. Verify current findings against current code, tests, and artifacts.',
  '',
  '- Generated at: 2026-05-10T00:00:00Z',
  '- Code map history: 2 snapshot(s), trend compared',
  '',
].join('\n'));
fs.mkdirSync(path.join(contextDir, 'latest'), { recursive: true });
fs.writeFileSync(path.join(contextDir, 'latest', 'latest-insights-report.json'), JSON.stringify({
  schema_version: '1',
  status: 'injected',
  reason: 'quality-check-passing',
  generated_at: '2026-05-20T00:00:00.000Z',
  git: {
    available: true,
    commit_short: commitShort,
    dirty: true,
  },
  check_status: 'pass',
  issue_count: 0,
}, null, 2));

const now = new Date('2026-05-20T00:00:00.000Z');
const cutoff = cutoffForPeriod('month', now);
const metrics = collectMetrics(metricsRoot, cutoff);
const patterns = summarizePatternLog(patternsDir, cutoff, now);
const report = buildReport({
  root,
  metricsRoot,
  patternsDir,
  projectDir,
  noDrift: true,
  now,
});
const reportWithDrift = buildReport({
  root,
  metricsRoot,
  patternsDir,
  projectDir,
  now,
});
const markdown = renderMarkdown(report);
const cli = spawnSync(process.execPath, [path.join(repoRoot, 'scripts/forgeflow/render-forgeflow-report.js'),
  '--root',
  root,
  '--metrics-root',
  metricsRoot,
  '--patterns-dir',
  patternsDir,
  '--project-dir',
  projectDir,
  '--no-drift',
  '--json',
], { encoding: 'utf8' });
const cliJson = cli.status === 0 ? JSON.parse(cli.stdout) : {};
const badPeriod = spawnSync(process.execPath, [path.join(repoRoot, 'scripts/forgeflow/render-forgeflow-report.js'),
  '--period',
  'year',
], { encoding: 'utf8' });

const checks = [
  ['collects metrics files', metrics.files === 1 && metrics.commands['/review'] === 2 && metrics.commands['/review-auto'] === 2],
  ['flags false positives', report.metrics.false_positives.flagged.length === 1 && report.metrics.false_positives.flagged[0].reviewer === 'smith'],
  ['summarizes pattern log', patterns.status === 'current' && patterns.totals.updates_applied === 2],
  ['includes context savings', report.context.summary.files === 1 && report.context.summary.percent_saved === 80],
  ['includes project trends', report.project_trends.code_map.trend.status === 'compared' && report.project_trends.freshness.status === 'current'],
  ['includes latest insights readiness', report.latest_insights.status === 'injected' && report.latest_insights.check_status === 'pass' && report.latest_insights.freshness.status === 'current'],
  ['includes live drift when enabled', reportWithDrift.drift.status === 'missing' || reportWithDrift.drift.status === 'fail' || reportWithDrift.drift.status === 'pass'],
  ['records report log', report.report_history.recorded === true && fs.readFileSync(path.join(patternsDir, '.report-log.jsonl'), 'utf8').trim().split(/\r?\n/).length >= 2],
  ['computes report trend', report.report_history.trend.status === 'compared' && report.report_history.trend.invocation_delta === 3],
  ['derives priorities', report.priorities.some((item) => item.includes('smith'))],
  ['renders markdown sections', markdown.includes('## 8. Project Trends') && markdown.includes('## 9. Priorities') && markdown.includes('Latest insights: injected') && markdown.includes('Latest insights freshness: current')],
  ['cli json works', cli.status === 0 && cliJson.metrics.false_positives.flagged.length === 1 && cliJson.report_history.recorded === true],
  ['invalid period exits usage', badPeriod.status === 2 && badPeriod.stderr.includes('Invalid --period')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log('forgeflow report: ok');
