#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  REQUIRED_METRICS,
  buildLeanBenchmarkResults,
  normalizePromptfooResults,
  parseArgs,
  renderMarkdown,
} = require('./render-lean-benchmark-results');

const root = path.resolve(__dirname, '..', '..');
const fixture = path.join(root, 'fixtures', 'lean-benchmark', 'sample-results.json');
const promptfooFixture = path.join(root, 'fixtures', 'lean-benchmark', 'sample-promptfoo-results.json');
const importedOut = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-benchmark-results-')), 'imported.json');
const result = buildLeanBenchmarkResults({ root, results: fixture });
const imported = buildLeanBenchmarkResults({ root, promptfoo: promptfooFixture, out: importedOut });
const normalized = normalizePromptfooResults({
  results: [
    {
      vars: { task: 'Update command wrapper' },
      prompt: { label: 'lean-balanced' },
      output: 'line one\nline two',
      gradingResult: { pass: true },
      latencyMs: 1200,
      cost: 0.002,
    },
  ],
});
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--results', fixture, '--json']);
const importOpts = parseArgs(['--root', root, '--promptfoo', promptfooFixture, '--out', importedOut, '--json']);

const checks = [
  ['benchmark results pass', result.status === 'pass' && result.summary.runs === 2],
  ['promptfoo import passes', imported.status === 'pass' && imported.summary.runs === 2 && imported.imported.format === 'promptfoo'],
  ['promptfoo normalizer maps required metrics', normalized.runs.length === 1 && normalized.runs[0].metrics.correct === 1 && normalized.runs[0].metrics.latency_seconds === 1.2],
  ['required metrics include cost and latency', REQUIRED_METRICS.includes('cost_usd') && REQUIRED_METRICS.includes('latency_seconds')],
  ['renders markdown', markdown.includes('# Forgeflow Lean Benchmark Results') && markdown.includes('read-only')],
  ['parses args', opts.root === root && opts.results === fixture && opts.json],
  ['parses import args', importOpts.promptfoo === promptfooFixture && importOpts.out === importedOut && importOpts.json],
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
