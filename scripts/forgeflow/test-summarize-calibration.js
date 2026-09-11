#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { applyRecord, createSummary } = require('./summarize-calibration');

const repoRoot = path.resolve(__dirname, '..', '..');
const fixture = path.join(repoRoot, 'fixtures/calibration/forgeflow-metrics.jsonl');

const summary = createSummary();
const originalBytes = fs.readFileSync(fixture);
const lines = originalBytes.toString('utf8').split(/\r?\n/).filter(Boolean);
for (const line of lines) {
  applyRecord(summary, JSON.parse(line));
}
const checks = [
  ['finding_overturned', summary.totals.finding_overturned, 1],
  ['finding_verified', summary.totals.finding_verified, 3],
  ['verifier_confirmed', summary.totals.verifier_confirmed, 1],
  ['verifier_rejected', summary.totals.verifier_rejected, 1],
  ['verifier_blocked', summary.totals.verifier_blocked, 1],
  ['auto_fix_applied', summary.totals.auto_fix_applied, 1],
  ['auto_fix_failed', summary.totals.auto_fix_failed, 1],
  ['warden confirmed', summary.agents.guardian.confirmed, 1],
  ['fc rejected', summary.agents.builder.rejected, 1],
  ['migration class rejected', summary.classes['migration/schema/data-loss'].rejected, 1],
];

const failures = checks.filter(([, actual, expected]) => actual !== expected);
if (failures.length) {
  for (const [name, actual, expected] of failures) {
    console.error(`${name}: ${actual} !== ${expected}`);
  }
  process.exit(1);
}


const assert = require('assert/strict');
const mixed = createSummary();
for (const reviewer of ['Warden', 'guardian-review', 'guardian_reviewer']) {
  applyRecord(mixed, { event: 'finding-verified', detail: { reviewer, decision: 'confirmed', finding_class: 'security' } });
}
assert.equal(mixed.agents.guardian.confirmed, 3);
assert.deepEqual(Object.keys(mixed.agents), ['guardian']);
assert.deepEqual(fs.readFileSync(fixture), originalBytes);

console.log('calibration summary: ok');
