#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { adviseContext, renderMarkdown } = require('./advise-context');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-advisor-'));
const contextDir = path.join(root, 'Forgeflow', 'context');
const config = path.join(root, 'missing-budget-config.json');
fs.mkdirSync(contextDir, { recursive: true });

const telemetryFile = path.join(contextDir, 'context-telemetry.json');
fs.writeFileSync(telemetryFile, `${JSON.stringify({
  schema_version: '1',
  kind: 'context-pack',
  baseline_chars: 12000,
  compact_chars: 10000,
  saved_chars: 2000,
  estimated_baseline_tokens: 3000,
  estimated_compact_tokens: 2500,
  estimated_saved_tokens: 500,
})}\n`);
fs.writeFileSync(path.join(contextDir, 'code-topology-telemetry.json'), `${JSON.stringify({
  schema_version: '1',
  kind: 'code-topology',
  baseline_chars: 1200,
  compact_chars: 800,
  saved_chars: 400,
  estimated_baseline_tokens: 300,
  estimated_compact_tokens: 200,
  estimated_saved_tokens: 100,
  detail: {
    source_files: 8,
    local_edges: 10,
    unresolved_imports: 1,
    skipped_dynamic_imports: 2,
  },
})}\n`);
fs.writeFileSync(path.join(contextDir, 'code-map-history.jsonl'), [
  JSON.stringify({
    schema_version: '1',
    generated_at: '2026-05-19T00:00:00Z',
    summary: {
      source_files: 8,
      local_edges: 9,
      unresolved_imports: 0,
      skipped_dynamic_imports: 1,
      sections: 12,
      changed_sections: 1,
      markdown_section_files: 1,
    },
    high_fan_in: [],
    high_fan_out: [],
  }),
  JSON.stringify({
    schema_version: '1',
    generated_at: '2026-05-20T00:00:00Z',
    summary: {
      source_files: 8,
      local_edges: 10,
      unresolved_imports: 1,
      skipped_dynamic_imports: 2,
      sections: 14,
      changed_sections: 3,
      markdown_section_files: 1,
    },
    high_fan_in: [{ path: 'scripts/forgeflow/build-context-pack.js', fan_in: 5, fan_out: 2 }],
    high_fan_out: [{ path: 'scripts/forgeflow/show-code-map.js', fan_in: 1, fan_out: 4 }],
  }),
  '',
].join('\n'));

const result = adviseContext({
  root,
  config,
  maxCompactTokens: 2000,
  maxCompactTokensSet: true,
  kindLimits: {},
  warnOnly: true,
  warnOnlySet: true,
});

const empty = adviseContext({
  root: path.join(root, 'missing'),
  config,
  maxCompactTokens: 2000,
  maxCompactTokensSet: true,
  kindLimits: {},
  warnOnly: true,
  warnOnlySet: true,
});

const smallRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-advisor-small-'));
const smallContextDir = path.join(smallRoot, 'Forgeflow', 'context');
fs.mkdirSync(smallContextDir, { recursive: true });
fs.writeFileSync(path.join(smallContextDir, 'memory-context-telemetry.json'), `${JSON.stringify({
  schema_version: '1',
  kind: 'memory-context',
  baseline_chars: 4000,
  compact_chars: 3600,
  saved_chars: 400,
  estimated_baseline_tokens: 1000,
  estimated_compact_tokens: 900,
  estimated_saved_tokens: 100,
})}\n`);
const smallLowSavings = adviseContext({
  root: smallRoot,
  config,
  maxCompactTokens: 2000,
  maxCompactTokensSet: true,
  kindLimits: {},
  warnOnly: true,
  warnOnlySet: true,
});
const cleanMarkdown = renderMarkdown(smallLowSavings);

const duplicateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-advisor-duplicate-'));
const duplicateContextDir = path.join(duplicateRoot, 'Forgeflow', 'context');
const duplicateLatestDir = path.join(duplicateContextDir, 'latest');
fs.mkdirSync(duplicateLatestDir, { recursive: true });
fs.writeFileSync(path.join(duplicateContextDir, 'code-topology-telemetry.json'), `${JSON.stringify({
  schema_version: '1',
  kind: 'code-topology',
  generated_at: '2026-05-20T00:00:00.000Z',
  baseline_chars: 1200,
  compact_chars: 800,
  saved_chars: 400,
  estimated_baseline_tokens: 300,
  estimated_compact_tokens: 200,
  estimated_saved_tokens: 100,
  detail: {
    source_files: 8,
    local_edges: 10,
    unresolved_imports: 1,
    skipped_dynamic_imports: 2,
  },
})}\n`);
fs.writeFileSync(path.join(duplicateLatestDir, 'code-topology-telemetry.json'), `${JSON.stringify({
  schema_version: '1',
  kind: 'code-topology',
  generated_at: '2026-05-21T00:00:00.000Z',
  baseline_chars: 2400,
  compact_chars: 400,
  saved_chars: 2000,
  estimated_baseline_tokens: 600,
  estimated_compact_tokens: 100,
  estimated_saved_tokens: 500,
  detail: {
    source_files: 9,
    local_edges: 12,
    unresolved_imports: 0,
    skipped_dynamic_imports: 0,
  },
})}\n`);
const deduped = adviseContext({
  root: duplicateRoot,
  config,
  maxCompactTokens: 2000,
  maxCompactTokensSet: true,
  kindLimits: {},
  warnOnly: true,
  warnOnlySet: true,
});
const notDeduped = adviseContext({
  root: duplicateRoot,
  config,
  dedupeTelemetry: false,
  maxCompactTokens: 2000,
  maxCompactTokensSet: true,
  kindLimits: {},
  warnOnly: true,
  warnOnlySet: true,
});

const duplicateBudgetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-advisor-duplicate-budget-'));
const duplicateBudgetContextDir = path.join(duplicateBudgetRoot, 'Forgeflow', 'context');
fs.mkdirSync(duplicateBudgetContextDir, { recursive: true });
fs.writeFileSync(path.join(duplicateBudgetContextDir, 'context-telemetry.json'), `${JSON.stringify({
  schema_version: '1',
  kind: 'context-pack',
  baseline_chars: 20000,
  compact_chars: 12000,
  saved_chars: 8000,
  estimated_baseline_tokens: 5000,
  estimated_compact_tokens: 3000,
  estimated_saved_tokens: 2000,
})}\n`);
fs.writeFileSync(path.join(duplicateBudgetContextDir, 'scope-telemetry.json'), `${JSON.stringify({
  schema_version: '1',
  kind: 'scope-manifest',
  baseline_chars: 24000,
  compact_chars: 10000,
  saved_chars: 14000,
  estimated_baseline_tokens: 6000,
  estimated_compact_tokens: 2500,
  estimated_saved_tokens: 3500,
})}\n`);
const duplicateBudget = adviseContext({
  root: duplicateBudgetRoot,
  config,
  maxCompactTokens: 1000,
  maxCompactTokensSet: true,
  kindLimits: {},
  warnOnly: true,
  warnOnlySet: true,
});
const zeroBudget = adviseContext({
  root: duplicateBudgetRoot,
  config,
  maxCompactTokens: 0,
  maxCompactTokensSet: true,
  kindLimits: {},
  warnOnly: true,
  warnOnlySet: true,
});

const historyPath = path.join(root, 'history', 'context-advisor.jsonl');
const firstRecorded = adviseContext({
  root,
  config,
  history: historyPath,
  record: true,
  now: new Date('2026-05-15T12:00:00.000Z'),
  maxCompactTokens: 3000,
  maxCompactTokensSet: true,
  kindLimits: {},
  warnOnly: true,
  warnOnlySet: true,
});

fs.writeFileSync(telemetryFile, `${JSON.stringify({
  schema_version: '1',
  kind: 'context-pack',
  baseline_chars: 16000,
  compact_chars: 8000,
  saved_chars: 8000,
  estimated_baseline_tokens: 4000,
  estimated_compact_tokens: 2000,
  estimated_saved_tokens: 2000,
})}\n`);

const secondRecorded = adviseContext({
  root,
  config,
  history: historyPath,
  record: true,
  now: new Date('2026-05-15T13:00:00.000Z'),
  maxCompactTokens: 3000,
  maxCompactTokensSet: true,
  kindLimits: {},
  warnOnly: true,
  warnOnlySet: true,
});

const historyLines = fs.readFileSync(historyPath, 'utf8').trim().split(/\r?\n/);
const markdown = renderMarkdown(result);
const symlinkHistoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-advisor-history-symlink-'));
const symlinkHistoryContextDir = path.join(symlinkHistoryRoot, 'Forgeflow', 'context');
fs.mkdirSync(symlinkHistoryContextDir, { recursive: true });
fs.writeFileSync(path.join(symlinkHistoryContextDir, 'context-telemetry.json'), `${JSON.stringify({
  schema_version: '1',
  kind: 'context-pack',
  baseline_chars: 8000,
  compact_chars: 4000,
  saved_chars: 4000,
  estimated_baseline_tokens: 2000,
  estimated_compact_tokens: 1000,
  estimated_saved_tokens: 1000,
})}\n`);
const outsideHistory = path.join(symlinkHistoryRoot, 'outside-history.jsonl');
fs.writeFileSync(outsideHistory, `${JSON.stringify({
  schema_version: '1',
  ts: '2026-05-15T10:00:00.000Z',
  estimated_compact_tokens: 999999,
  estimated_saved_tokens: 0,
  percent_saved: 0,
  budget_violations: 99,
})}\n`);
const symlinkHistoryPath = path.join(symlinkHistoryRoot, 'history.jsonl');
fs.symlinkSync(outsideHistory, symlinkHistoryPath);
let symlinkHistoryBlocked = false;
try {
  adviseContext({
    root: symlinkHistoryRoot,
    config,
    history: symlinkHistoryPath,
    record: true,
    maxCompactTokens: 2000,
    maxCompactTokensSet: true,
    kindLimits: {},
    warnOnly: true,
    warnOnlySet: true,
  });
} catch (err) {
  symlinkHistoryBlocked = err.message.includes('symlinked file');
}
const outsideHistoryPath = path.join(os.tmpdir(), `forgeflow-context-advisor-outside-${process.pid}.jsonl`);
let outsideHistoryBlocked = false;
try {
  adviseContext({
    root: symlinkHistoryRoot,
    config,
    history: outsideHistoryPath,
    record: true,
    maxCompactTokens: 2000,
    maxCompactTokensSet: true,
    kindLimits: {},
    warnOnly: true,
    warnOnlySet: true,
  });
} catch (err) {
  outsideHistoryBlocked = err.message.includes('outside root');
}

const checks = [
  ['files summarized', result.summary.files === 2],
  ['code topology summarized', result.code_topology.status === 'attention' && result.code_topology.unresolved_imports === 1 && result.code_topology.skipped_dynamic_imports === 2],
  ['code map trends summarized', result.code_map_trends.status === 'attention' && result.code_map_trends.unresolved_imports_delta === 1 && result.code_map_trends.changed_sections_delta === 2],
  ['code map trend recommendations', result.recommendations.some((item) => item.action === 'review-code-map-unresolved-growth') && result.recommendations.some((item) => item.action === 'review-code-map-new-hotspots')],
  ['code topology kind included', result.summary.by_kind['code-topology'].files === 1],
  ['code topology renders', markdown.includes('## Code Topology') && markdown.includes('Unresolved imports: 1')],
  ['code map trends render', markdown.includes('## Code Map Trends') && markdown.includes('New high fan-in: scripts/forgeflow/build-context-pack.js')],
  ['budget warns', result.budget.status === 'warn'],
  ['budget recommendation', result.recommendations.some((item) => item.action === 'trim-budget-violation')],
  ['budget recommendation explains gate', result.recommendations.some((item) => item.action === 'trim-budget-violation' && item.evidence && item.clears)],
  ['budget recommendation includes split suggestion', result.recommendations.some((item) => item.action === 'trim-budget-violation' && item.split_suggestion && item.split_suggestion.strategy === 'split-before-review')],
  ['budget recommendation includes trim plan', result.recommendations.some((item) => item.action === 'trim-budget-violation' && item.trim_plan && item.trim_plan.strategy === 'advisory-auto-trim' && item.trim_plan.reduce_by_tokens === 500 && item.trim_plan.commands.some((command) => command.includes('--files')) && item.trim_plan.stop_rule.includes('raw-required failure evidence'))],
  ['auto trim advisor present', result.auto_trim_advisor.status === 'recommended' && result.auto_trim_advisor.actions.some((item) => item.reduce_by_tokens === 500 && item.first_command.includes('build-context-pack'))],
  ['auto trim advisor stays advisory', result.auto_trim_advisor.boundary.includes('does not edit context packets')],
  ['auto trim advisor renders', markdown.includes('## Auto-Trim Advisor') && markdown.includes('First command: build-context-pack')],
  ['auto trim advisor hidden when clean', !cleanMarkdown.includes('## Auto-Trim Advisor')],
  ['auto trim zero target stable', zeroBudget.auto_trim_advisor.target_compact_tokens === 0],
  ['budget markdown includes split suggestion', markdown.includes('Split: Run a narrower context pack')],
  ['budget markdown includes trim plan', markdown.includes('Trim plan: target 2000 compact tokens, reduce by 500') && markdown.includes('Stop rule: Do not trim raw-required failure evidence')],
  ['compaction recommendation', result.recommendations.some((item) => item.action === 'improve-compaction')],
  ['small low savings not noisy', !smallLowSavings.recommendations.some((item) => item.action === 'improve-compaction')],
  ['latest telemetry preferred', deduped.summary.files === 1 && deduped.summary.by_kind['code-topology'].estimated_compact_tokens === 100 && deduped.code_topology.status === 'covered'],
  ['dedupe can be disabled', notDeduped.summary.files === 2 && notDeduped.code_topology.files === 2],
  ['duplicate budget recommendations merged', duplicateBudget.recommendations.filter((item) => item.action === 'trim-budget-violation').length === 1 && duplicateBudget.recommendations[0].reason.includes('Also:') && duplicateBudget.recommendations[0].evidence && duplicateBudget.recommendations[0].clears],
  ['empty recommendation', empty.recommendations.some((item) => item.action === 'generate-context-telemetry')],
  ['history first recorded', firstRecorded.history.recorded === true],
  ['history compared', secondRecorded.history.trend.status === 'compared'],
  ['history compact delta', secondRecorded.history.trend.compact_token_delta === -500],
  ['history saved delta', secondRecorded.history.trend.saved_token_delta === 1500],
  ['history has two lines', historyLines.length === 2],
  ['symlink history blocked', symlinkHistoryBlocked],
  ['outside history blocked', outsideHistoryBlocked],
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

console.log('context advisor: ok');
