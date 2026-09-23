#!/usr/bin/env node
const assert = require('node:assert/strict');
const { POLICY, workload, execute, correct, summarize } = require('../../fixtures/benchmark-verification/cpu.cjs');
const input = workload(100);
const enabled = execute(input, { batches: 1 });
const disabled = execute(input, { batches: 1, disableIndexed: true });
const forbidden = execute(input, { batches: 1, disableIndexed: true, forbidFallback: true });
for (const row of [enabled, disabled]) {
  assert.equal(correct(row, 100, 1), true);
  assert.equal(row.checksum, 83350);
  assert.ok(row.elapsed_ns > 0);
}
assert.deepEqual(enabled.calls, { allocating: 0, indexed: 1 });
assert.deepEqual(disabled.calls, { allocating: 1, indexed: 0 });
assert.deepEqual(forbidden.calls, { allocating: 0, indexed: 0 });
assert.equal(forbidden.status, 'unavailable');
assert.equal(correct(execute(input, { batches: 1, corrupt: true }), 100, 1), false);
assert.throws(() => workload(101));
assert.throws(() => execute(input, { requested: 'npu' }));
assert.throws(() => execute(input, { batches: Infinity }));
const rows = [];
for (const arm of ['allocating', 'indexed']) {
  for (let repeat = 0; repeat < POLICY.repeats; repeat++) rows.push({ stage: 'measured', repeat, arm,
    status: 'completed', checksum: 83350 * POLICY.size / 100 * POLICY.batches, completed_items: POLICY.size * POLICY.batches,
    elapsed_ns: 1000000 * (repeat + 1), calls: { allocating: arm === 'allocating' ? POLICY.batches : 0, indexed: arm === 'indexed' ? POLICY.batches : 0 } });
}
const summary = summarize(rows);
assert.equal(summary.indexed.median_batch_ms, 3.5);
assert.equal(summary.indexed.total_completed_items_per_second, 12000000 / 0.021);
assert.equal(summary.indexed.power_watts, null);
assert.equal(summary.indexed.memory_bytes, null);
assert.throws(() => summarize(rows.slice(1)), /unqualified/);
for (const patch of [{ status: 'timeout' }, { checksum: 0 }, { elapsed_ns: 0 }, { calls: { allocating: 20, indexed: 20 } }]) {
  const invalid = structuredClone(rows); Object.assign(invalid[0], patch);
  assert.throws(() => summarize(invalid), /unqualified/);
}
console.log('CPU benchmark correctness, actual dispatch controls and synthetic aggregation checks passed; no timing threshold in tests');
