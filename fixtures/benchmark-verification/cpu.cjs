#!/usr/bin/env node
// Bounded CPU example. Both implementations execute JavaScript on the CPU.
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const POLICY = Object.freeze({ size: 100000, batches: 20, warmups: 2, repeats: 6,
  timeout_seconds: 30, interval: 'synchronous dispatch through completed checksum; input creation excluded; per-batch allocations included',
  hypothesis: 'The indexed CPU loop has lower median batch latency than the allocating CPU pipeline on this fixed integer workload.',
  acceptance: 'all outputs correct and indexed median elapsed time below allocating median; descriptive only',
  order: 'alternate allocating/indexed and indexed/allocating; warmups separate from measured repeats' });

function workload(size = POLICY.size) {
  if (!Number.isInteger(size) || size < 100 || size > POLICY.size || size % 100) throw new Error('size must be a bounded multiple of 100');
  return Float64Array.from({ length: size }, (_, index) => index % 100 - 50);
}
function execute(input, { requested = 'indexed', disableIndexed = false, forbidFallback = false, corrupt = false, batches = POLICY.batches } = {}) {
  if (!['allocating', 'indexed'].includes(requested)) throw new Error('unknown CPU implementation');
  if (!Number.isInteger(batches) || batches < 1 || batches > POLICY.batches) throw new Error('invalid batch count');
  const calls = { allocating: 0, indexed: 0 };
  if (requested === 'indexed' && disableIndexed && forbidFallback) return { status: 'unavailable', requested, calls, checksum: null, completed_items: 0, elapsed_ns: null };
  function allocating() {
    calls.allocating++;
    return Array.from(input).map(value => value * value).reduce((sum, value) => sum + value, 0);
  }
  function indexed() {
    calls.indexed++;
    let sum = 0;
    for (let index = 0; index < input.length; index++) sum += input[index] * input[index];
    return sum;
  }
  const operation = requested === 'indexed' && !disableIndexed ? indexed : allocating;
  let checksum = 0;
  const start = process.hrtime.bigint();
  for (let batch = 0; batch < batches; batch++) checksum += operation();
  const elapsed = process.hrtime.bigint() - start;
  return { status: 'completed', requested, calls, checksum: checksum + (corrupt ? 1 : 0),
    completed_items: input.length * batches, elapsed_ns: Number(elapsed) };
}
// Each complete cycle is -50..49: sum(k*k, k=1..50) + sum(k*k, k=1..49) = 83350.
function correct(row, size = POLICY.size, batches = POLICY.batches) {
  return row.status === 'completed' && row.checksum === size / 100 * 83350 * batches && row.completed_items === size * batches;
}
function median(values) { const sorted = [...values].sort((a, b) => a - b); const middle = sorted.length / 2; return (sorted[Math.floor(middle)] + sorted[Math.ceil(middle) - 1]) / 2; }
function summarize(rows) {
  const summary = {};
  for (const arm of ['allocating', 'indexed']) {
    const selected = rows.filter(row => row.stage === 'measured' && row.arm === arm);
    if (selected.length !== POLICY.repeats || selected.some(row => !correct(row) || !Number.isFinite(row.elapsed_ns) || row.elapsed_ns <= 0
        || row.calls[arm] !== POLICY.batches || row.calls[arm === 'indexed' ? 'allocating' : 'indexed'] !== 0)) throw new Error('unqualified CPU samples');
    const milliseconds = selected.map(row => row.elapsed_ns / 1e6);
    summary[arm] = { samples: selected.length, median_batch_ms: median(milliseconds), min_batch_ms: Math.min(...milliseconds), max_batch_ms: Math.max(...milliseconds),
      total_completed_items_per_second: selected.reduce((sum, row) => sum + row.completed_items, 0) / (selected.reduce((sum, row) => sum + row.elapsed_ns, 0) / 1e9),
      memory_bytes: null, power_watts: null, energy_joules: null };
  }
  return summary;
}
function run() {
  const input = workload();
  const rows = [];
  const report = { schema_version: 1, evidence: 'actual-cpu', protocol: POLICY,
    identity: { source_sha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
      source_revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: path.resolve(__dirname, '../..'), encoding: 'utf8' }).trim(),
      command: 'timeout 30s node fixtures/benchmark-verification/cpu.cjs', build: 'uncompiled CommonJS source; no external dependencies',
      runtime: process.version, v8: process.versions.v8, flags: process.execArgv, node_options: process.env.NODE_OPTIONS ? 'present; run invalid until sanitized configuration recorded' : null,
      platform: process.platform, architecture: process.arch, kernel: os.release(), cpu_model: os.cpus()[0]?.model || 'unknown',
      logical_cpus: os.cpus().length, dispatch: 'single synchronous JS thread; runtime/GC may use other threads',
      power_mode: 'unobserved', competing_workload: 'uncontrolled', accelerator: 'not used' }, rows, controls: null, summary: null };
  if (process.env.NODE_OPTIONS) throw new Error('Run with NODE_OPTIONS unset for this fixed example');
  for (const stage of ['warmup', 'measured']) {
    for (let repeat = 0; repeat < (stage === 'warmup' ? POLICY.warmups : POLICY.repeats); repeat++) {
      for (const arm of repeat % 2 ? ['indexed', 'allocating'] : ['allocating', 'indexed']) {
        const row = { stage, repeat, arm, ...execute(input, { requested: arm }) };
        rows.push(row);
        if (!correct(row)) { report.failure = 'incorrect-output'; return report; }
      }
    }
  }
  report.controls = { enabled: execute(input), disabled: execute(input, { disableIndexed: true }),
    forbidden: execute(input, { disableIndexed: true, forbidFallback: true }), restored: execute(input), wrong: execute(input, { corrupt: true }) };
  const c = report.controls;
  if (!correct(c.enabled) || !correct(c.disabled) || !correct(c.restored) || correct(c.wrong)
      || c.enabled.calls.indexed !== POLICY.batches || c.disabled.calls.allocating !== POLICY.batches
      || c.restored.calls.indexed !== POLICY.batches || c.forbidden.status !== 'unavailable'
      || c.forbidden.calls.indexed !== 0 || c.forbidden.calls.allocating !== 0) { report.failure = 'control-failed'; return report; }
  report.summary = summarize(rows);
  report.hypothesis_met = report.summary.indexed.median_batch_ms < report.summary.allocating.median_batch_ms;
  return report;
}
if (require.main === module) {
  try { const report = run(); process.stdout.write(`${JSON.stringify(report, null, 2)}\n`); if (report.failure) process.exitCode = 1; }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { POLICY, workload, execute, correct, summarize };
