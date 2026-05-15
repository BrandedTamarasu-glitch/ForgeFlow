#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runHealthCheck } = require('./health-check');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-health-'));
fs.writeFileSync(path.join(root, '.gitignore'), 'node_modules/\n');

const before = runHealthCheck({ root, fix: false });
const fixed = runHealthCheck({ root, fix: true });
const again = runHealthCheck({ root, fix: true });

const project = path.basename(root);
const checks = [
  ['before fails', before.status === 'fail'],
  ['fixed passes', fixed.status === 'pass'],
  ['forgeflow dir created', fs.existsSync(path.join(root, '.forgeflow', project))],
  ['agent notes created', fs.existsSync(path.join(root, '.forgeflow', project, 'agent-notes'))],
  ['gitignore updated', fs.readFileSync(path.join(root, '.gitignore'), 'utf8').includes('.forgeflow/')],
  ['budget seeded', fs.existsSync(path.join(root, '.forgeflow-budget.json'))],
  ['idempotent no changes', again.changes.length === 0],
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

console.log('health check: ok');
