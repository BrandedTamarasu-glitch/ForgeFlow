#!/usr/bin/env node
const assert = require('node:assert/strict');
const { execute, experiment, assess } = require('../../fixtures/benchmark-verification/model');

const clean = experiment();
const result = assess(clean);
assert.equal(result.status, 'fixture-qualified');
assert.equal(result.evidence, 'synthetic');
const reorderedProtocol = structuredClone(clean);
reorderedProtocol.protocol = Object.fromEntries(Object.entries(reorderedProtocol.protocol).reverse());
assert.equal(assess(reorderedProtocol).status, 'fixture-qualified', 'JSON key order does not change a protocol');
assert.deepEqual(result.metrics.baseline.latency_ms, [8, 8, 8]);
assert.deepEqual(result.metrics.treatment.latency_ms, [2, 2, 2]);
assert.deepEqual(result.metrics.treatment.throughput_items_per_second, [2000, 2000, 2000]);
assert.notEqual(result.metrics.treatment.throughput_items_per_second[0], 1000 / 2, 'batch throughput is not reciprocal latency');
for (const metrics of Object.values(result.metrics)) {
  for (const key of ['memory_bytes', 'power_watts', 'energy_joules']) assert.equal(metrics[key], null);
}
assert.deepEqual(clean.controls.enabled.calls, { cpu: 0, vector: 1 });
assert.deepEqual(clean.controls.disabled.calls, { cpu: 1, vector: 0 });
assert.deepEqual(clean.controls.forbidden.calls, { cpu: 0, vector: 0 });
assert.deepEqual(clean.controls.restored.calls, { cpu: 0, vector: 1 });
assert.equal(clean.controls.enabled.output, 87);
assert.equal(clean.controls.disabled.output, 87);
assert.throws(() => execute({ requested: 'npu' }), /unknown backend/);

let rejected = 0;
function rejects(report, reason, claimed) {
  const verdict = assess(report, claimed);
  assert.equal(verdict.status, 'rejected');
  assert.ok(verdict.problems.includes(reason), JSON.stringify(verdict));
  assert.equal(verdict.metrics, null, 'invalid runs cannot yield qualified metrics');
  rejected++;
}
rejects(experiment({ disabled: true }), 'attribution'); // Request says vector, execution says CPU.
rejects(experiment({ ignoreDisable: true }), 'negative-control'); // Control flag is ignored by dispatch.
rejects(experiment({ corrupt: true }), 'correctness');
rejects(clean, 'attribution', 'npu'); // A simulated vector path cannot attest NPU execution.
function mutation(change, reason) { const copy = structuredClone(clean); change(copy); rejects(copy, reason); }
mutation(report => { report.rows.pop(); }, 'schedule');
mutation(report => { report.rows[3] = report.rows[2]; }, 'schedule');
mutation(report => { report.rows.reverse(); }, 'schedule');
mutation(report => { report.rows[0].output = 0; }, 'correctness'); // Warmups still need correctness.
mutation(report => { report.rows[3].status = 'timeout'; }, 'correctness');
mutation(report => { report.rows[3].calls = { cpu: 1, vector: 1 }; }, 'attribution');
mutation(report => { delete report.rows[3].calls; }, 'attribution');
for (const value of [0, -1, NaN, Infinity, null]) mutation(report => { report.rows[3].elapsed_ms = value; }, 'measurement');
mutation(report => { report.rows[3].completed_items = 1000; }, 'correctness');
mutation(report => { report.protocol.repeats = 1; }, 'protocol');
mutation(report => { report.protocol.unit = 'seconds'; }, 'protocol');
mutation(report => { report.evidence = 'hardware'; }, 'protocol');
mutation(report => { delete report.controls; }, 'negative-control');
mutation(report => { report.controls.forbidden.calls.cpu = 1; }, 'negative-control');
mutation(report => { report.controls.disabled.output = 0; }, 'negative-control');
console.log(`benchmark verification: clean synthetic comparison and ${rejected} invalid evidence cases passed; no hardware or model-benefit measurement`);
