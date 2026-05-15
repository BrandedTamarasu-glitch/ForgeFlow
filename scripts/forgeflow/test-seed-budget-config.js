#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { seedBudgetConfig } = require('./seed-budget-config');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-budget-seed-'));
const template = path.join(tmpDir, 'template.json');
const out = path.join(tmpDir, '.forgeflow-budget.json');

fs.writeFileSync(template, `${JSON.stringify({
  max_compact_tokens: 1234,
  warn_only: true,
  kind_limits: { 'context-pack': 1000 },
})}\n`);

const first = seedBudgetConfig({ root: tmpDir, template, out });
const firstContent = JSON.parse(fs.readFileSync(out, 'utf8'));
fs.writeFileSync(out, `${JSON.stringify({ max_compact_tokens: 9999 })}\n`);
const second = seedBudgetConfig({ root: tmpDir, template, out });
const secondContent = JSON.parse(fs.readFileSync(out, 'utf8'));
const forced = seedBudgetConfig({ root: tmpDir, template, out, force: true });
const forcedContent = JSON.parse(fs.readFileSync(out, 'utf8'));

const checks = [
  ['first written', first.written === true],
  ['first value', firstContent.max_compact_tokens === 1234],
  ['second skipped', second.status === 'exists' && second.written === false],
  ['no overwrite', secondContent.max_compact_tokens === 9999],
  ['force written', forced.written === true],
  ['force restored template', forcedContent.max_compact_tokens === 1234],
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

console.log('budget seed: ok');
