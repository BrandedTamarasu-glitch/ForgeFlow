// Checkout-only synthetic dispatch and timing model; no hardware measurements.
const { isDeepStrictEqual } = require('node:util');
const INPUT = Object.freeze([2, -3, 5, 7]);
const EXPECTED = 87; // Independently calculated sum of squares.
const PROTOCOL = Object.freeze({ warmups: 1, repeats: 3, items: INPUT.length,
  hypothesis: 'Synthetic vector path completes the same sum of squares with lower modeled batch latency.',
  interval: 'complete batch including modeled dispatch', unit: 'ms',
  environment: 'in-process simulation, no accelerator', command: 'node scripts/forgeflow/test-benchmark-verification.js' });

function execute({ requested = 'vector', disabled = false, allowFallback = true, ignoreDisable = false, corrupt = false } = {}) {
  const calls = { cpu: 0, vector: 0 };
  function cpu() { calls.cpu++; let value = 0; for (const item of INPUT) value += item * item; return value; }
  function vector() { calls.vector++; return INPUT.map(item => item * item).reduce((a, b) => a + b, 0); }
  if (requested !== 'cpu' && requested !== 'vector') throw new Error('unknown backend');
  const unavailable = disabled && !ignoreDisable;
  if (requested === 'vector' && unavailable && !allowFallback) {
    return { status: 'unavailable', requested, calls, output: null, elapsed_ms: null, completed_items: 0 };
  }
  const value = requested === 'vector' && !unavailable ? vector() : cpu();
  return { status: 'completed', requested, calls, output: corrupt ? value + 1 : value,
    elapsed_ms: calls.vector ? 2 : 8, completed_items: INPUT.length };
}

function experiment(options = {}) {
  const rows = [];
  for (const stage of ['warmup', 'measured']) {
    const count = stage === 'warmup' ? PROTOCOL.warmups : PROTOCOL.repeats;
    for (let repeat = 0; repeat < count; repeat++) {
      for (const arm of repeat % 2 ? ['treatment', 'baseline'] : ['baseline', 'treatment']) {
        const row = execute(arm === 'baseline' ? { requested: 'cpu' } : options);
        rows.push({ stage, repeat, arm, ...row });
      }
    }
  }
  return { evidence: 'synthetic', protocol: { ...PROTOCOL }, rows,
    controls: { enabled: execute(options), disabled: execute({ ...options, disabled: true }),
      forbidden: execute({ ...options, disabled: true, allowFallback: false }), restored: execute(options) } };
}

// Deliberately limited to this frozen fixture, not a general benchmark certifier.
function assess(report, claimedBackend = 'vector') {
  const problems = new Set();
  const flag = reason => problems.add(reason);
  const backend = row => {
    if (row?.calls?.cpu === 1 && row.calls.vector === 0) return 'cpu';
    if (row?.calls?.vector === 1 && row.calls.cpu === 0) return 'vector';
    return null;
  };
  const correct = row => row?.status === 'completed' && row.output === EXPECTED && row.completed_items === INPUT.length;
  if (report.evidence !== 'synthetic' || !isDeepStrictEqual(report.protocol, PROTOCOL)) flag('protocol');
  const rows = Array.isArray(report.rows) ? report.rows : [];
  const expectedSlots = [];
  for (const stage of ['warmup', 'measured']) {
    for (let repeat = 0; repeat < (stage === 'warmup' ? PROTOCOL.warmups : PROTOCOL.repeats); repeat++) {
      for (const arm of repeat % 2 ? ['treatment', 'baseline'] : ['baseline', 'treatment']) expectedSlots.push(`${stage}:${repeat}:${arm}`);
    }
  }
  if (JSON.stringify(rows.map(row => `${row.stage}:${row.repeat}:${row.arm}`)) !== JSON.stringify(expectedSlots)) flag('schedule');
  for (const row of rows) {
    if (!correct(row)) flag('correctness');
    if (backend(row) !== (row.arm === 'baseline' ? 'cpu' : claimedBackend)) flag('attribution');
    if (!Number.isFinite(row.elapsed_ms) || row.elapsed_ms <= 0) flag('measurement');
  }
  const { enabled, disabled, forbidden, restored } = report.controls || {};
  if (!correct(enabled) || !correct(disabled) || !correct(restored)
      || backend(enabled) !== 'vector' || backend(disabled) !== 'cpu' || backend(restored) !== 'vector'
      || forbidden?.status !== 'unavailable' || forbidden?.calls?.cpu !== 0 || forbidden?.calls?.vector !== 0
      || forbidden?.completed_items !== 0 || forbidden?.output !== null || forbidden?.elapsed_ms !== null) flag('negative-control');
  if (problems.size) return { status: 'rejected', problems: [...problems], metrics: null };
  const metrics = {};
  for (const arm of ['baseline', 'treatment']) {
    const samples = rows.filter(row => row.stage === 'measured' && row.arm === arm);
    const latency = samples.map(row => row.elapsed_ms);
    metrics[arm] = { latency_ms: latency,
      throughput_items_per_second: samples.map(row => row.completed_items * 1000 / row.elapsed_ms),
      memory_bytes: null, power_watts: null, energy_joules: null };
  }
  return { status: 'fixture-qualified', evidence: 'synthetic', problems: [], metrics };
}
module.exports = { execute, experiment, assess };
