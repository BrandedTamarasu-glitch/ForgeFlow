#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { safeReadTextFile } = require('./file-safety');

const REQUIRED_METRICS = ['code_loc', 'correct', 'cost_usd', 'latency_seconds'];

function usage() {
  console.error('Usage: render-lean-benchmark-results.js --results <json> [--root <repo>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), results: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--results') {
      opts.results = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!opts.results) throw new Error('Missing --results <json>');
  return opts;
}

function readResults(root, file) {
  return JSON.parse(safeReadTextFile(file, root).content);
}

function hasMetrics(run) {
  const metrics = run.metrics || {};
  return REQUIRED_METRICS.every((key) => Number.isFinite(Number(metrics[key])));
}

function buildLeanBenchmarkResults(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const file = path.resolve(opts.results || '');
  if (!file) throw new Error('Missing results file');
  const parsed = readResults(root, file);
  const runs = Array.isArray(parsed.runs) ? parsed.runs : [];
  const checks = [];
  checks.push({ name: 'schema version present', status: parsed.schema_version === '1' ? 'pass' : 'fail' });
  checks.push({ name: 'provider present', status: parsed.provider && parsed.model ? 'pass' : 'fail' });
  checks.push({ name: 'run date present', status: parsed.run_date ? 'pass' : 'fail' });
  checks.push({ name: 'sample size visible', status: Number(parsed.repeat || 0) >= 3 ? 'pass' : 'fail' });
  checks.push({ name: 'runs present', status: runs.length > 0 ? 'pass' : 'fail' });
  checks.push({ name: 'required metrics present', status: runs.length > 0 && runs.every(hasMetrics) ? 'pass' : 'fail' });
  checks.push({ name: 'correctness gate visible', status: runs.length > 0 && runs.every((run) => Number(run.metrics?.correct) >= 0) ? 'pass' : 'fail' });
  const claims = parsed.claims || {};
  const hasPerformanceClaim = Boolean(claims.cost || claims.latency || claims.loc);
  checks.push({ name: 'performance claims have aggregate evidence', status: !hasPerformanceClaim || checks.slice(1, 6).every((item) => item.status === 'pass') ? 'pass' : 'fail' });
  checks.push({ name: 'session-cost caveat present', status: String(parsed.caveats || '').toLowerCase().includes('session') && String(parsed.caveats || '').toLowerCase().includes('cost') ? 'pass' : 'fail' });
  const failures = checks.filter((item) => item.status === 'fail').length;
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    results: file,
    status: failures ? 'fail' : 'pass',
    checks,
    summary: { checks: checks.length, failures, runs: runs.length },
    next: failures ? 'Add provider/date/sample/metric/caveat evidence before publishing lean benchmark claims.' : '/forgeflow-lean-benchmark',
    boundary: 'Lean benchmark results validation is read-only. It checks aggregate metadata and claim support but does not run models, install dependencies, mutate context, commit, push, or call the network.',
  };
}

function renderMarkdown(result) {
  const lines = ['# Forgeflow Lean Benchmark Results', '', `Status: ${result.status}`, '', result.boundary, '', '## Checks', ''];
  for (const item of result.checks) lines.push(`- ${item.status}: ${item.name}`);
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildLeanBenchmarkResults(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
    if (result.status === 'fail') process.exit(1);
  } catch (err) {
    console.error(`lean benchmark results failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  REQUIRED_METRICS,
  buildLeanBenchmarkResults,
  parseArgs,
  renderMarkdown,
};
