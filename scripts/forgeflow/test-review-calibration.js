#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { scoreReview } = require('./score-review-calibration');
const { reviewInput } = require('../../fixtures/review-calibration/prompts');
const { cases } = require('../../fixtures/review-calibration/inputs.json');
const key = require('../../fixtures/review-calibration/answer-key.json');
const operations = require('../../fixtures/atomicity/operations');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../..', key.provenance.source))).digest('hex'), key.provenance.source_sha256);
assert.equal(cases.length, 6);
assert.equal(key.cases.length, cases.length);
for (const item of cases) {
  const answer = key.cases.find(entry => entry.id === item.id);
  assert.ok(answer);
  assert.deepEqual(Object.keys(item).sort(), ['code', 'id', 'requirement']);
  assert.equal(item.code, operations[answer.operation].toString().replace(answer.operation, 'operation'));
  assert.ok(reviewInput(item.id).includes(item.code));
  assert.ok(!reviewInput(item.id).includes('defect-'));
  const silent = scoreReview({ expected: answer.expected, findings: [], observation: 'fixture', run_status: 'completed' });
  assert.equal(silent.missed_defects, answer.expected.length);
  assert.equal(silent.verified_completion, answer.expected.length === 0, 'silence must fail defective cases');
}
assert.throws(() => reviewInput('absent'), /Unknown/);
// Execute the exact code given to reviewers, not an answer-key implementation.
const op = id => vm.runInNewContext(`(${cases.find(item => item.id === id).code})`);
for (const id of ['rc01', 'rc02']) {
  const store = { current: { primary: 0, index: 0 } };
  assert.throws(() => op(id)(store, 1, () => { throw new Error('interrupted'); }), /interrupted/);
  assert.equal(store.current.primary === store.current.index, id === 'rc02');
}
for (const id of ['rc03', 'rc04']) {
  const store = { current: { count: 0, version: 0 } };
  const first = op(id)(store), second = op(id)(store);
  first(); const result = second();
  if (id === 'rc04') { assert.equal(result, false); assert.equal(op(id)(store)(), true); }
  assert.equal(store.current.count, id === 'rc04' ? 2 : 1);
}
const hints = { cacheWarm: false, hintReady: false };
assert.throws(() => op('rc05')(hints, () => { throw new Error('interrupted'); }), /interrupted/);
assert.deepEqual(hints, { cacheWarm: true, hintReady: false });
op('rc05')(hints); assert.deepEqual(hints, { cacheWarm: true, hintReady: true });
const visits = new Map(); op('rc06')(visits, 'one'); op('rc06')(visits, 'one'); assert.equal(visits.get('one'), 2);

const expected = [{ id: 'd1', severity: 'high' }, { id: 'd2', severity: 'medium' }];
const finding = (id, defect_id, severity) => ({ id, defect_id, severity, disposition: 'matched', evidence: 'Synthetic adjudication with mechanism checked by the test.' });
const base = { expected, observation: 'fixture', run_status: 'completed' };
const correct = [finding('f1', 'd1', 'high'), finding('f2', 'd2', 'medium')];
assert.equal(scoreReview({ ...base, findings: correct }).verified_completion, true);
const mixed = scoreReview({ ...base, findings: [finding('f1', 'd1', 'low'), { id: 'f3', severity: 'high', disposition: 'false', evidence: 'Claim contradicts the supplied contract.' }] });
assert.equal(mixed.missed_defects, 1); assert.equal(mixed.false_findings, 1); assert.equal(mixed.severity_under, 1); assert.equal(mixed.verified_completion, false);
assert.equal(scoreReview({ ...base, findings: [finding('f1', 'd1', 'critical')] }).severity_over, 1);
const unresolved = scoreReview({ ...base, findings: [{ id: 'u1', severity: 'medium', disposition: 'unresolved', evidence: 'Mechanism requires adjudication.' }] });
assert.equal(unresolved.verified_completion, null); assert.equal(unresolved.missed_defects, null); assert.equal(unresolved.unresolved, 1);
for (const observation of ['fixture', 'actual', 'unobserved']) {
  // Synthetic parser checks, including the actual branch; no model ran.
  const result = scoreReview({ ...base, observation, run_status: observation === 'unobserved' ? 'unobserved' : 'failed', findings: [] });
  assert.equal(result.verified_completion, null); assert.equal(result.false_findings, null);
}
for (const findings of [[null], [{ ...correct[0], evidence: '' }], [correct[0], { ...correct[0], id: 'duplicate' }], [finding('f1', 'unknown', 'high')], [{ ...correct[0], severity: 'urgent' }]]) assert.throws(() => scoreReview({ ...base, findings }));
assert.throws(() => scoreReview({ ...base, expected: [...expected, expected[0]], findings: [] }), /duplicate/);
assert.throws(() => scoreReview({ ...base, run_status: 'failed', findings: correct }), /Non-completed/);
assert.throws(() => scoreReview({ ...base, observation: 'unobserved', findings: [] }), /disagree/);
console.log('review calibration: six executable cases and synthetic adjudication checks passed; no model observations');
