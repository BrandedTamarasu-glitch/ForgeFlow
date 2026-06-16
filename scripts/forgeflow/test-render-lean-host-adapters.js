#!/usr/bin/env node
const path = require('path');
const {
  HOST_ADAPTERS,
  buildLeanHostAdapters,
  parseArgs,
  renderMarkdown,
} = require('./render-lean-host-adapters');

const root = path.resolve(__dirname, '..', '..');
const result = buildLeanHostAdapters({ root });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--json']);

const checks = [
  ['host adapter validation passes', result.status === 'pass' && result.summary.adapters === HOST_ADAPTERS.length],
  ['covers plugin and instruction tiers', result.adapters.some((item) => item.tier === 'plugin') && result.adapters.some((item) => item.tier === 'instruction')],
  ['checks opencode adapter', result.adapters.some((item) => item.host === 'OpenCode' && item.status === 'pass')],
  ['renders markdown', markdown.includes('# Forgeflow Lean Host Adapters') && markdown.includes('OpenClaw')],
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
console.log('lean host adapters: ok');
