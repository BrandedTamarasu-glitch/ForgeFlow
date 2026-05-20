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
  ['compaction recommendation', result.recommendations.some((item) => item.action === 'improve-compaction')],
  ['small low savings not noisy', !smallLowSavings.recommendations.some((item) => item.action === 'improve-compaction')],
  ['empty recommendation', empty.recommendations.some((item) => item.action === 'generate-context-telemetry')],
  ['history first recorded', firstRecorded.history.recorded === true],
  ['history compared', secondRecorded.history.trend.status === 'compared'],
  ['history compact delta', secondRecorded.history.trend.compact_token_delta === -500],
  ['history saved delta', secondRecorded.history.trend.saved_token_delta === 1500],
  ['history has two lines', historyLines.length === 2],
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
