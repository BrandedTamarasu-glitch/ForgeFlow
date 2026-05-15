#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { adviseContext } = require('./advise-context');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-advisor-'));
const contextDir = path.join(root, 'Forgeflow', 'context');
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

const result = adviseContext({
  root,
  maxCompactTokens: 2000,
  maxCompactTokensSet: true,
  kindLimits: {},
  warnOnly: true,
  warnOnlySet: true,
});

const empty = adviseContext({
  root: path.join(root, 'missing'),
  maxCompactTokens: 2000,
  maxCompactTokensSet: true,
  kindLimits: {},
  warnOnly: true,
  warnOnlySet: true,
});

const checks = [
  ['files summarized', result.summary.files === 1],
  ['budget warns', result.budget.status === 'warn'],
  ['budget recommendation', result.recommendations.some((item) => item.action === 'trim-budget-violation')],
  ['compaction recommendation', result.recommendations.some((item) => item.action === 'improve-compaction')],
  ['empty recommendation', empty.recommendations.some((item) => item.action === 'generate-context-telemetry')],
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
