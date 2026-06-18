#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { safeReadTextFile, writeJsonSafe } = require('./file-safety');

const REQUIRED_METRICS = ['code_loc', 'correct', 'cost_usd', 'latency_seconds'];

function usage() {
  console.error('Usage: render-lean-benchmark-results.js --results <json> [--root <repo>] [--json]');
  console.error('       render-lean-benchmark-results.js --promptfoo <json> --out <json> [--root <repo>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), results: '', promptfoo: '', out: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--results') {
      opts.results = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--promptfoo') {
      opts.promptfoo = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--out') {
      opts.out = path.resolve(requireValue(argv, arg, i));
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
  if (!opts.results && !opts.promptfoo) throw new Error('Missing --results <json> or --promptfoo <json>');
  if (opts.promptfoo && !opts.out) throw new Error('Missing --out <json> for --promptfoo import');
  return opts;
}

function readResults(root, file) {
  return JSON.parse(safeReadTextFile(file, root).content);
}

function hasMetrics(run) {
  const metrics = run.metrics || {};
  return REQUIRED_METRICS.every((key) => Number.isFinite(Number(metrics[key])));
}

function slug(value, fallback) {
  const text = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return text || fallback;
}

function promptfooEntries(parsed) {
  if (Array.isArray(parsed.results)) return parsed.results;
  if (Array.isArray(parsed.evalResults)) return parsed.evalResults;
  if (Array.isArray(parsed.table?.body)) return parsed.table.body;
  if (Array.isArray(parsed.outputs)) return parsed.outputs;
  return [];
}

function entryOutput(entry) {
  return String(
    entry.output
    || entry.response?.output
    || entry.response?.content
    || entry.response
    || entry.result
    || '',
  );
}

function entryCorrect(entry) {
  const pass = entry.gradingResult?.pass ?? entry.success ?? entry.pass;
  if (pass === true) return 1;
  if (pass === false) return 0;
  const score = Number(entry.gradingResult?.score ?? entry.score);
  return Number.isFinite(score) ? score : 0;
}

function normalizePromptfooResults(parsed, opts = {}) {
  const entries = promptfooEntries(parsed);
  const runs = entries.map((entry, index) => {
    const vars = entry.vars || entry.test?.vars || {};
    const output = entryOutput(entry);
    const arm = entry.prompt?.label || entry.prompt?.id || entry.promptId || entry.prompt || `arm-${index + 1}`;
    const latencyMs = Number(entry.latencyMs ?? entry.latency_ms ?? entry.response?.latencyMs);
    const latencySeconds = Number(entry.latency_seconds ?? entry.latencySeconds);
    return {
      task_id: vars.task_id || slug(vars.task || entry.test?.description || entry.description, `task-${index + 1}`),
      arm: slug(arm, `arm-${index + 1}`),
      iteration: Number(entry.iteration || entry.run || 1),
      metrics: {
        code_loc: output ? output.split(/\r?\n/).filter((line) => line.trim()).length : Number(entry.metrics?.code_loc || 0),
        correct: entryCorrect(entry),
        cost_usd: Number(entry.cost ?? entry.cost_usd ?? entry.metrics?.cost_usd ?? 0),
        latency_seconds: Number.isFinite(latencySeconds) ? latencySeconds : (Number.isFinite(latencyMs) ? latencyMs / 1000 : Number(entry.metrics?.latency_seconds || 0)),
      },
    };
  });
  const provider = parsed.provider || parsed.config?.providers?.[0]?.id || parsed.providerId || '<provider>';
  const model = parsed.model || parsed.config?.providers?.[0]?.id || parsed.modelId || '<model>';
  const repeat = Math.max(3, ...runs.map((run) => Number(run.iteration || 1)).filter(Number.isFinite));
  return {
    schema_version: '1',
    provider,
    model,
    run_date: opts.runDate || new Date().toISOString().slice(0, 10),
    repeat,
    caveats: 'Imported Promptfoo output is generation evidence only; multi-turn session cost can differ from single-turn benchmark cost.',
    runs,
    claims: {},
    source: {
      format: 'promptfoo',
      entries: entries.length,
    },
  };
}

function importPromptfooResults(root, promptfooFile, outFile) {
  const parsed = readResults(root, promptfooFile);
  const normalized = normalizePromptfooResults(parsed);
  writeJsonSafe(outFile, normalized);
  return normalized;
}

function buildLeanBenchmarkResults(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const file = path.resolve(opts.results || opts.out || '');
  if (!file) throw new Error('Missing results file');
  const imported = opts.promptfoo ? importPromptfooResults(root, path.resolve(opts.promptfoo), file) : null;
  const parsed = imported || readResults(root, file);
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
    imported: opts.promptfoo ? { source: path.resolve(opts.promptfoo), output: file, format: 'promptfoo' } : null,
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
  importPromptfooResults,
  normalizePromptfooResults,
  parseArgs,
  renderMarkdown,
};
