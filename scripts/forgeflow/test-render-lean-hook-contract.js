#!/usr/bin/env node
const path = require('path');
const {
  buildLeanHookContract,
  classifySpawn,
  parseArgs,
  renderMarkdown,
} = require('./render-lean-hook-contract');

const root = path.resolve(__dirname, '..', '..');
const result = buildLeanHookContract({ root });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--json']);

const checks = [
  ['hook contract does not fail in this environment', ['pass', 'warn'].includes(result.status) && result.summary.failures === 0],
  ['reports spawn checks', result.checks.length === 2],
  ['classifies eperm as environment blocked', classifySpawn({ error: { code: 'EPERM' } }) === 'environment-blocked'],
  ['renders markdown', markdown.includes('# Forgeflow Lean Hook Contract')],
  ['parses args', opts.root === root && opts.json],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('lean hook contract: ok');
