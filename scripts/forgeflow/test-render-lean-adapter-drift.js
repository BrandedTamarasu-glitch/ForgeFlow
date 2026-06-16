#!/usr/bin/env node
const path = require('path');
const {
  COPIES,
  INVARIANTS,
  buildLeanAdapterDrift,
  parseArgs,
  renderMarkdown,
} = require('./render-lean-adapter-drift');

const root = path.resolve(__dirname, '..', '..');
const result = buildLeanAdapterDrift({ root });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--json']);

const checks = [
  ['adapter drift passes', result.status === 'pass' && result.summary.copies === COPIES.length],
  ['all invariants checked', INVARIANTS.includes('trust-boundary validation') && INVARIANTS.includes('data-loss prevention')],
  ['covers openclaw copy', result.copies.some((item) => item.host === 'OpenClaw' && item.status === 'pass')],
  ['renders markdown', markdown.includes('# Forgeflow Lean Adapter Drift') && markdown.includes('read-only')],
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
console.log('lean adapter drift: ok');
