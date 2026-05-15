#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkBudget } = require('./check-context-budget');
const { walk } = require('./summarize-context-telemetry');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-budget-'));
const contextDir = path.join(root, 'Forgeflow/context');
fs.mkdirSync(contextDir, { recursive: true });

const scopeFile = path.join(contextDir, 'scope-telemetry.json');
fs.writeFileSync(scopeFile, `${JSON.stringify({
  schema_version: '1',
  kind: 'scope-manifest',
  estimated_compact_tokens: 1200,
})}\n`);

const memoryFile = path.join(contextDir, 'memory-context-telemetry.json');
fs.writeFileSync(memoryFile, `${JSON.stringify({
  schema_version: '1',
  kind: 'memory-context',
  estimated_compact_tokens: 300,
})}\n`);

const files = walk(root);
const pass = checkBudget(files, {
  maxCompactTokens: 1500,
  kindLimits: {},
  warnOnly: false,
});
const fail = checkBudget(files, {
  maxCompactTokens: 1000,
  kindLimits: {},
  warnOnly: false,
});
const warn = checkBudget(files, {
  maxCompactTokens: 1000,
  kindLimits: {},
  warnOnly: true,
});
const kindPass = checkBudget(files, {
  maxCompactTokens: 1000,
  kindLimits: { 'scope-manifest': 1300 },
  warnOnly: false,
});

const checks = [
  ['walk includes scope telemetry', files.includes(scopeFile)],
  ['pass status', pass.status === 'pass'],
  ['fail status', fail.status === 'fail'],
  ['fail violation', fail.violations[0].kind === 'scope-manifest'],
  ['warn status', warn.status === 'warn'],
  ['kind override pass', kindPass.status === 'pass'],
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

console.log('context budget: ok');
