#!/usr/bin/env node
const {
  CASES,
  buildLeanRobustnessEval,
  parseArgs,
  renderMarkdown,
} = require('./render-lean-robustness-eval');

const result = buildLeanRobustnessEval();
const markdown = renderMarkdown(result);
const opts = parseArgs(['--json']);

const checks = [
  ['robustness eval passes selftest', result.status === 'pass' && result.summary.cases === CASES.length],
  ['includes correctness traps', result.cases.some((item) => item.name === 'leap-year-century') && result.cases.some((item) => item.name === 'credit-card-luhn')],
  ['renders markdown', markdown.includes('# Forgeflow Lean Robustness Eval') && markdown.includes('known-lazy-wrong')],
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
console.log('lean robustness eval: ok');
