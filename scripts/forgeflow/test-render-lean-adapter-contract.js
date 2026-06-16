#!/usr/bin/env node
const path = require('path');
const {
  buildLeanAdapterContract,
  parseArgs,
  renderMarkdown,
} = require('./render-lean-adapter-contract');

const root = path.resolve(__dirname, '..', '..');
const result = buildLeanAdapterContract({ root });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--project-dir', path.join(root, '.forgeflow', 'Forgeflow'), '--json']);

const checks = [
  ['adapter contract passes', result.status === 'pass' && result.summary.checks >= 8],
  ['checks plugin hook wiring', result.checks.some((item) => item.name.includes('plugin manifest') && item.status === 'pass')],
  ['checks target matrix', result.adapter_targets.some((target) => target.name === 'openclaw')],
  ['renders markdown', markdown.includes('# Forgeflow Lean Adapter Contract') && markdown.includes('portability target matrix')],
  ['parses args', opts.root === root && opts.projectDir.endsWith(path.join('.forgeflow', 'Forgeflow')) && opts.json],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('lean adapter contract: ok');
