#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { summarize, record } = require('../../fixtures/completion-pilot/measurement');
const events = types => types.map((type, i) => ({ type, boot_id: 'synthetic-boot', monotonic_ns: String(BigInt(i) * 1000000000n) }));
const pass = summarize(events(['start', 'submission', 'validation_passed']));
assert.equal(pass.verified_completion_seconds, 2); assert.deepEqual(pass.correction, { status: 'not_applicable', seconds: null });
const corrected = summarize(events(['start', 'submission', 'validation_failed', 'correction_submission', 'validation_passed']));
assert.equal(corrected.initial_submission_seconds, 1); assert.equal(corrected.verified_completion_seconds, 4);
assert.deepEqual(corrected.correction, { status: 'observed', seconds: 2 });
for (const terminal of ['timeout', 'interrupted', 'validation_failed']) {
  const result = summarize(events(['start', 'submission', 'validation_failed', 'correction_submission', terminal]));
  assert.equal(result.verified_completion_seconds, null); assert.deepEqual(result.correction, { status: 'censored', seconds: null });
}
assert.deepEqual(summarize(events(['start', 'timeout'])).correction, { status: 'unobserved', seconds: null });
assert.equal(summarize(events(['start', 'submission'])).outcome, 'pending');
for (const bad of [['validation_passed'], ['start', 'validation_passed'], ['start', 'start'], ['start', 'submission', 'validation_passed', 'submission'], ['start', 'submission', 'validation_failed', 'correction_submission', 'validation_failed', 'correction_submission']]) assert.throws(() => summarize(events(bad)), /transition/);
const reverse = events(['start', 'submission']); reverse[0].monotonic_ns = '2000000000'; assert.throws(() => summarize(reverse), /reversed/);
const reboot = events(['start', 'submission']); reboot[1].boot_id = 'different'; assert.throws(() => summarize(reboot), /epoch/);
const late = events(['start', 'submission', 'validation_passed']);
late[1].monotonic_ns = '601000000000'; late[2].monotonic_ns = '602000000000';
assert.equal(summarize(late).qualifies_within_budget, false);
assert.deepEqual(summarize(late).budget_exceeded, ['initial-workflow']);
const slowValidation = events(['start', 'submission', 'validation_passed']); slowValidation[2].monotonic_ns = '32000000000';
assert.deepEqual(summarize(slowValidation).budget_exceeded, ['initial-acceptance']);
const lateCorrection = events(['start', 'submission', 'validation_failed', 'correction_submission', 'validation_passed']);
lateCorrection[3].monotonic_ns = '363000000000'; lateCorrection[4].monotonic_ns = '364000000000';
assert.deepEqual(summarize(lateCorrection).budget_exceeded, ['correction-workflow']);
const timedOut = events(['start', 'timeout']); timedOut[1].monotonic_ns = '601000000000';
assert.deepEqual(summarize(timedOut).budget_exceeded, ['initial-workflow']);
const correctionTimeout = events(['start', 'submission', 'validation_failed', 'timeout']); correctionTimeout[3].monotonic_ns = '363000000000';
assert.deepEqual(summarize(correctionTimeout).budget_exceeded, ['correction-workflow']);
assert.throws(() => summarize([]), /count/);
assert.throws(() => summarize([{ type: 'start', boot_id: 'boot', monotonic_ns: '1.5' }]), /clock/);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-completion-clock-'));
try {
  const file = path.join(temporary, 'events.json');
  if (process.platform !== 'linux') {
    console.log('Linux event recording unavailable on this host; pure clock/state checks still run');
  } else {
    record(file, 'start'); record(file, 'submission'); const observed = record(file, 'validation_passed');
    assert.ok(observed.verified_completion_seconds >= 0);
    const before = fs.readFileSync(file); assert.throws(() => record(file, 'start'), /transition/); assert.deepEqual(fs.readFileSync(file), before);
  }
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
console.log('completion measurements: pass/correction/censoring, ordering, clock epoch and available-host recording checks passed; no model trial');
