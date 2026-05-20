#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  parseProjectLearnings,
  projectFreshness,
  renderMarkdown,
  showProjectTrends,
} = require('./show-project-trends');

const repoRoot = path.resolve(__dirname, '..', '..');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-project-trends-'));
const projectDir = path.join(root, '.forgeflow', 'Demo');
const contextDir = path.join(projectDir, 'context');
fs.mkdirSync(contextDir, { recursive: true });

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
fs.writeFileSync(path.join(projectDir, 'project-learnings.md'), [
  '# Project Learnings',
  '',
  '## Sources',
  '',
  '- Code map history: 2 snapshot(s), trend compared',
  '',
].join('\n'));

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
const missingFreshness = projectFreshness({
  current: { available: true, commit_short: 'ccccccc', dirty: false },
  latest: null,
  projectLearnings: { present: false },
});

const checks = [
  ['summarizes history count', result.code_map.history_snapshots === 2],
  ['compares code map trend', result.code_map.trend.status === 'compared' && result.code_map.trend.unresolved_imports_delta === 1],
  ['reports new hotspots', result.code_map.new_high_fan_in.includes('src/core.ts') && result.code_map.new_high_fan_out.includes('src/app.ts')],
  ['detects learning consumption', result.project_learnings.consumed_code_map_trend === true && parsedLearnings.consumed_code_map_trend === true && parsedLearnings.consumed_code_map_history_snapshots === 2 && parsedLearnings.generated_at === ''],
  ['summarizes freshness', result.freshness.status === 'attention' && result.freshness.issues.some((item) => item.code === 'project-learnings-generated-at-missing')],
  ['detects stale code map freshness', staleFreshness.status === 'attention' && staleFreshness.issues.some((item) => item.code === 'code-map-commit-stale') && staleFreshness.issues.some((item) => item.code === 'code-map-dirty-stale')],
  ['detects stale project learning code-map consumption', staleLearningFreshness.status === 'attention' && staleLearningFreshness.issues.some((item) => item.code === 'project-learnings-code-map-stale')],
  ['detects missing freshness inputs', missingFreshness.status === 'missing' && missingFreshness.issues.some((item) => item.code === 'code-map-missing') && missingFreshness.issues.some((item) => item.code === 'project-learnings-missing')],
  ['summarizes advisor', result.advisor.budget_status === 'pass' && result.advisor.code_map_trends_status === 'attention'],
  ['renders markdown', markdown.includes('# Forgeflow Project Trends') && markdown.includes('Unresolved imports delta: 1') && markdown.includes('## Freshness')],
  ['cli json works', cli.status === 0 && cliJson.code_map.trend.status === 'compared' && cliJson.project_learnings.consumed_code_map_trend === true && Boolean(cliJson.freshness)],
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
