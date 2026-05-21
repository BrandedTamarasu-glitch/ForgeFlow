#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  latestInsightsFreshness,
  parseProjectLearnings,
  projectFreshness,
  renderMarkdown,
  showProjectTrends,
} = require('./show-project-trends');

const repoRoot = path.resolve(__dirname, '..', '..');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-project-trends-'));
const projectDir = path.join(root, '.forgeflow', 'Demo');
const contextDir = path.join(projectDir, 'context');
const latestDir = path.join(contextDir, 'latest');
fs.mkdirSync(contextDir, { recursive: true });
fs.mkdirSync(latestDir, { recursive: true });

fs.writeFileSync(path.join(contextDir, 'code-map-history.jsonl'), [
  JSON.stringify({
    schema_version: '1',
    generated_at: '2026-05-19T00:00:00Z',
    commit_short: 'aaaaaaa',
    dirty: false,
    summary: {
      source_files: 4,
      local_edges: 3,
      unresolved_imports: 0,
      skipped_dynamic_imports: 0,
      sections: 20,
      changed_sections: 1,
      markdown_section_files: 2,
    },
    high_fan_in: [],
    high_fan_out: [],
  }),
  JSON.stringify({
    schema_version: '1',
    generated_at: '2026-05-20T00:00:00Z',
    commit_short: 'bbbbbbb',
    dirty: true,
    summary: {
      source_files: 5,
      local_edges: 5,
      unresolved_imports: 1,
      skipped_dynamic_imports: 0,
      sections: 24,
      changed_sections: 3,
      markdown_section_files: 2,
    },
    high_fan_in: [{ path: 'src/core.ts', fan_in: 4, fan_out: 1 }],
    high_fan_out: [{ path: 'src/app.ts', fan_in: 1, fan_out: 4 }],
  }),
  '',
].join('\n'));
fs.writeFileSync(path.join(contextDir, 'code-topology-telemetry.json'), JSON.stringify({
  schema_version: '1',
  kind: 'code-topology',
  baseline_chars: 8000,
  compact_chars: 2000,
  saved_chars: 6000,
  estimated_baseline_tokens: 2000,
  estimated_compact_tokens: 500,
  estimated_saved_tokens: 1500,
  detail: {
    source_files: 5,
    local_edges: 5,
    unresolved_imports: 1,
    skipped_dynamic_imports: 0,
  },
}) + '\n');
fs.writeFileSync(path.join(latestDir, 'context-telemetry.json'), JSON.stringify({
  schema_version: '1',
  kind: 'context-pack',
  baseline_chars: 100000,
  compact_chars: 80000,
  saved_chars: 20000,
  estimated_baseline_tokens: 25000,
  estimated_compact_tokens: 20000,
  estimated_saved_tokens: 5000,
  detail: {},
}) + '\n');
fs.writeFileSync(path.join(contextDir, 'code-topology.json'), JSON.stringify({
  schema_version: '1',
  unresolved: [
    { source: 'src/app.ts', specifier: './missing', kind: 'import' },
  ],
  skipped_dynamic: [
    { source: 'src/routes.ts', expression: '`./pages/${name}`' },
  ],
}, null, 2));
fs.writeFileSync(path.join(projectDir, 'project-learnings.md'), [
  '# Project Learnings',
  '',
  '## Sources',
  '',
  '- Code map history: 2 snapshot(s), trend compared',
  '',
].join('\n'));
fs.writeFileSync(path.join(latestDir, 'latest-insights-report.json'), JSON.stringify({
  schema_version: '1',
  status: 'injected',
  reason: 'quality-check-passing',
  generated_at: '2026-05-20T00:00:00.000Z',
  git: {
    available: false,
    commit_short: '',
    dirty: true,
  },
  check_status: 'pass',
  issue_count: 0,
}, null, 2));

const result = showProjectTrends({ root, projectDir });
const markdown = renderMarkdown(result);
const cli = spawnSync(path.join(repoRoot, 'scripts/forgeflow/show-project-trends.js'), [
  '--project-dir',
  projectDir,
  '--json',
], { encoding: 'utf8' });
const cliJson = cli.status === 0 ? JSON.parse(cli.stdout) : {};
const missingValue = spawnSync(path.join(repoRoot, 'scripts/forgeflow/show-project-trends.js'), [
  '--project-dir',
], { encoding: 'utf8' });
const parsedLearnings = parseProjectLearnings(fs.readFileSync(path.join(projectDir, 'project-learnings.md'), 'utf8'));
const staleFreshness = projectFreshness({
  current: { available: true, commit_short: 'ccccccc', dirty: true },
  latest: { generated_at: '2026-05-20T00:00:00Z', commit_short: 'bbbbbbb', dirty: false },
  historySnapshots: 2,
  projectLearnings: parsedLearnings,
});
const staleLearningFreshness = projectFreshness({
  current: { available: true, commit_short: 'bbbbbbb', dirty: false },
  latest: { generated_at: '2026-05-20T00:00:00Z', commit_short: 'bbbbbbb', dirty: false },
  historySnapshots: 3,
  projectLearnings: {
    present: true,
    generated_at: '2026-05-20T00:00:00Z',
    consumed_code_map_history_snapshots: 2,
  },
});
const refreshLagFreshness = projectFreshness({
  current: { available: true, commit_short: 'bbbbbbb', dirty: false },
  latest: { generated_at: '2026-05-20T00:00:00Z', commit_short: 'bbbbbbb', dirty: false },
  historySnapshots: 3,
  projectLearnings: {
    present: true,
    generated_at: '2026-05-20T00:00:00Z',
    consumed_code_map_history_snapshots: 2,
  },
  allowRefreshLag: true,
});
const missingFreshness = projectFreshness({
  current: { available: true, commit_short: 'ccccccc', dirty: false },
  latest: null,
  projectLearnings: { present: false },
});
const staleInsightsFreshness = latestInsightsFreshness({
  git: { available: true, commit_short: 'bbbbbbb', dirty: false },
}, repoRoot);
const staleGuidance = showProjectTrends({ root: repoRoot, projectDir });
const infoProjectDir = path.join(root, '.forgeflow', 'InfoOnly');
const infoContextDir = path.join(infoProjectDir, 'context');
const infoLatestDir = path.join(infoContextDir, 'latest');
fs.mkdirSync(infoLatestDir, { recursive: true });
fs.writeFileSync(path.join(infoContextDir, 'code-map-history.jsonl'), `${JSON.stringify({
  schema_version: '1',
  generated_at: '2026-05-20T00:00:00Z',
  commit_short: '',
  dirty: true,
  summary: {
    source_files: 1,
    local_edges: 0,
    unresolved_imports: 1,
    skipped_dynamic_imports: 0,
    sections: 1,
    changed_sections: 0,
    markdown_section_files: 0,
  },
  high_fan_in: [],
  high_fan_out: [],
})}\n`);
fs.writeFileSync(path.join(infoContextDir, 'code-topology.json'), JSON.stringify({
  schema_version: '1',
  unresolved: [
    { source: 'fixtures/demo/test-app.ts', specifier: './missing', kind: 'import' },
  ],
  skipped_dynamic: [],
}, null, 2));
fs.writeFileSync(path.join(infoProjectDir, 'project-learnings.md'), [
  '# Project Learnings',
  '',
  '## Sources',
  '',
  '- Generated at: 2026-05-20T00:00:00Z',
  '- Code map history: 1 snapshot(s)',
  '',
].join('\n'));
fs.writeFileSync(path.join(infoLatestDir, 'latest-insights-report.json'), JSON.stringify({
  schema_version: '1',
  status: 'injected',
  reason: 'quality-check-passing',
  generated_at: '2026-05-20T00:00:00.000Z',
  git: { available: false, commit_short: '', dirty: true },
  check_status: 'pass',
  issue_count: 0,
}, null, 2));
const infoOnlyGaps = showProjectTrends({ root, projectDir: infoProjectDir });
const refreshCli = spawnSync(path.join(repoRoot, 'scripts/forgeflow/show-project-trends.js'), [
  '--project-dir',
  projectDir,
  '--refresh',
  '--json',
], { encoding: 'utf8' });
const refreshCliJson = refreshCli.status === 0 ? JSON.parse(refreshCli.stdout) : {};

const checks = [
  ['summarizes history count', result.code_map.history_snapshots === 2],
  ['compares code map trend', result.code_map.trend.status === 'compared' && result.code_map.trend.unresolved_imports_delta === 1],
  ['reports new hotspots', result.code_map.new_high_fan_in.includes('src/core.ts') && result.code_map.new_high_fan_out.includes('src/app.ts')],
  ['summarizes import gaps', result.import_gaps.status === 'attention' && result.import_gaps.unresolved_total === 1 && result.import_gaps.skipped_dynamic_total === 1 && result.recommendations.some((item) => item.command === 'forgeflow-code-map')],
  ['summarizes import gap triage', result.import_gaps.triage.expected_total === 1 && result.import_gaps.triage.needs_review_total === 1 && result.import_gaps.triage.categories.some((item) => item.category === 'local-module-missing')],
  ['keeps test fixture import gaps informational', infoOnlyGaps.import_gaps.status === 'info' && infoOnlyGaps.import_gaps.production_total === 0 && infoOnlyGaps.import_gaps.test_fixture_total === 1 && !infoOnlyGaps.recommendations.some((item) => item.command === 'forgeflow-code-map')],
  ['detects learning consumption', result.project_learnings.consumed_code_map_trend === true && parsedLearnings.consumed_code_map_trend === true && parsedLearnings.consumed_code_map_history_snapshots === 2 && parsedLearnings.generated_at === ''],
  ['summarizes freshness', result.freshness.status === 'attention' && result.freshness.issues.some((item) => item.code === 'project-learnings-generated-at-missing')],
  ['recommends refresh for stale artifacts', staleGuidance.recommendations.some((item) => item.command === 'forgeflow-trends --refresh')],
  ['summarizes latest insights', result.latest_insights.status === 'injected' && result.latest_insights.check_status === 'pass' && result.latest_insights.freshness.status === 'current'],
  ['detects stale latest insights', staleInsightsFreshness.status === 'attention' && staleInsightsFreshness.issues.some((item) => item.code === 'latest-insights-commit-stale')],
  ['detects stale code map freshness', staleFreshness.status === 'attention' && staleFreshness.issues.some((item) => item.code === 'code-map-commit-stale') && staleFreshness.issues.some((item) => item.code === 'code-map-dirty-stale')],
  ['detects stale project learning code-map consumption', staleLearningFreshness.status === 'attention' && staleLearningFreshness.issues.some((item) => item.code === 'project-learnings-code-map-stale')],
  ['allows refresh smoke code-map lag', refreshLagFreshness.status === 'current'],
  ['detects missing freshness inputs', missingFreshness.status === 'missing' && missingFreshness.issues.some((item) => item.code === 'code-map-missing') && missingFreshness.issues.some((item) => item.code === 'project-learnings-missing')],
  ['summarizes advisor', result.advisor.budget_status === 'warn' && result.advisor.code_map_trends_status === 'attention' && result.advisor.recommendations.some((item) => item.action === 'trim-budget-violation')],
  ['renders markdown', markdown.includes('# Forgeflow Project Trends') && markdown.includes('## Recommendations') && markdown.includes('Unresolved imports delta: 1') && markdown.includes('## Import Gaps') && markdown.includes('Needs review: 1') && markdown.includes('forgeflow-code-map') && markdown.includes('## Latest Insights') && markdown.includes('Narrow file scope')],
  ['cli json works', cli.status === 0 && cliJson.code_map.trend.status === 'compared' && cliJson.project_learnings.consumed_code_map_trend === true && Boolean(cliJson.freshness) && cliJson.latest_insights.status === 'injected' && cliJson.import_gaps.status === 'attention'],
  ['refresh cli works', refreshCli.status === 0 && refreshCliJson.refresh && refreshCliJson.refresh.check_status === 'pass'],
  ['missing option value exits usage', missingValue.status === 2 && missingValue.stderr.includes('Missing value for --project-dir')],
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

console.log('project trends: ok');
