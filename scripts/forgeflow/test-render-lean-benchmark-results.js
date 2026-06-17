#!/usr/bin/env node
const path = require('path');
const {
  REQUIRED_METRICS,
  buildLeanBenchmarkResults,
  parseArgs,
  renderMarkdown,
} = require('./render-lean-benchmark-results');

const root = path.resolve(__dirname, '..', '..');
const fixture = path.join(root, 'fixtures', 'lean-benchmark', 'sample-results.json');
const result = buildLeanBenchmarkResults({ root, results: fixture });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--results', fixture, '--json']);

const checks = [
  ['benchmark results pass', result.status === 'pass' && result.summary.runs === 2],
  ['required metrics include cost and latency', REQUIRED_METRICS.includes('cost_usd') && REQUIRED_METRICS.includes('latency_seconds')],
  ['renders markdown', markdown.includes('# Forgeflow Lean Benchmark Results') && markdown.includes('read-only')],
  ['parses args', opts.root === root && opts.results === fixture && opts.json],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('lean benchmark results: ok');
