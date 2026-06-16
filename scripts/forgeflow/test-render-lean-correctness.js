#!/usr/bin/env node
const {
  CASES,
  buildLeanCorrectness,
  parseArgs,
  renderMarkdown,
  runSnippet,
} = require('./render-lean-correctness');

const result = buildLeanCorrectness();
const markdown = renderMarkdown(result);
const opts = parseArgs(['--json']);
const sample = CASES.find((item) => item.name === 'leap-year');

const checks = [
  ['correctness selftest passes', result.status === 'pass' && result.summary.cases === CASES.length],
  ['good snippet executes', runSnippet(sample, sample.good).ok],
  ['bad snippet is rejected', !runSnippet(sample, sample.bad).ok],
  ['renders markdown', markdown.includes('# Forgeflow Lean Correctness') && markdown.includes('bad_rejected=true')],
  ['parses args', opts.json],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('lean correctness: ok');
