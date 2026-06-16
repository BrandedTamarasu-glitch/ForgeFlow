#!/usr/bin/env node
const path = require('path');
const {
  buildLeanEvalPack,
  expectedMatches,
  parseArgs,
  renderMarkdown,
} = require('./render-lean-eval-pack');

const root = path.resolve(__dirname, '..', '..');
const result = buildLeanEvalPack({ root });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--cases', path.join(root, 'fixtures', 'lean-eval', 'sample-cases.json'), '--json']);

const checks = [
  ['sample eval passes expectations', result.status === 'pass' && result.summary.cases >= 5],
  ['sample eval contains expected failing observations', result.summary.observed_failures >= 3],
  ['expected matcher works', expectedMatches('not-pass', 'warn') && !expectedMatches('pass', 'warn')],
  ['renders markdown', markdown.includes('# Forgeflow Lean Eval Pack') && markdown.includes('hardware-calibration-good')],
  ['parses args', opts.root === root && opts.cases.endsWith(path.join('fixtures', 'lean-eval', 'sample-cases.json')) && opts.json],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('lean eval pack: ok');
