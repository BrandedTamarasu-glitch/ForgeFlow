#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { summarize } = require('./summarize-context-telemetry');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-telemetry-'));
const reviewDir = path.join(root, 'Forgeflow/context/latest');
const planDir = path.join(root, 'Forgeflow/context');
fs.mkdirSync(reviewDir, { recursive: true });
fs.mkdirSync(planDir, { recursive: true });

fs.writeFileSync(path.join(reviewDir, 'context-telemetry.json'), `${JSON.stringify({
  schema_version: '1',
  kind: 'context-pack',
  baseline_chars: 400,
  compact_chars: 100,
  saved_chars: 300,
  estimated_baseline_tokens: 100,
  estimated_compact_tokens: 25,
  estimated_saved_tokens: 75,
})}\n`);
fs.writeFileSync(path.join(planDir, 'memory-context-telemetry.json'), `${JSON.stringify({
  schema_version: '1',
  kind: 'memory-context',
  baseline_chars: 200,
  compact_chars: 80,
  saved_chars: 120,
  estimated_baseline_tokens: 50,
  estimated_compact_tokens: 20,
  estimated_saved_tokens: 30,
})}\n`);

const summary = summarize([
  path.join(reviewDir, 'context-telemetry.json'),
  path.join(planDir, 'memory-context-telemetry.json'),
]);

const checks = [
  ['files', summary.files === 2],
  ['total saved tokens', summary.totals.estimated_saved_tokens === 105],
  ['percent saved', summary.percent_saved === 70],
  ['context pack bucket', summary.by_kind['context-pack'].estimated_saved_tokens === 75],
  ['memory bucket', summary.by_kind['memory-context'].estimated_saved_tokens === 30],
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

console.log('context telemetry summary: ok');
