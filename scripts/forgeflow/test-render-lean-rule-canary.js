#!/usr/bin/env node
const path = require('path');
const {
  INVARIANTS,
  buildLeanRuleCanary,
  parseArgs,
  renderMarkdown,
} = require('./render-lean-rule-canary');

const root = path.resolve(__dirname, '..', '..');
const result = buildLeanRuleCanary({ root });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--json']);

const checks = [
  ['rule canary passes', result.status === 'pass' && result.summary.checks >= INVARIANTS.length],
  ['pins safety carve-outs', result.checks.some((item) => item.name.includes('security')) && result.checks.some((item) => item.name.includes('accessibility'))],
  ['renders markdown', markdown.includes('# Forgeflow Lean Rule Canary')],
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
console.log('lean rule canary: ok');
