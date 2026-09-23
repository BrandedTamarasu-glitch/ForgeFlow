#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  publishSeparate, publishSnapshot, prepareIncrement, prepareConditionalIncrement,
  setIndependentHints, upsertVisit,
} = require('../../fixtures/atomicity/operations');
const key = require('../../fixtures/atomicity/answer-key.json');
const { buildStub } = require('./generate-codex-agent-stubs');

const results = new Map();
const coherent = state => state.primary === state.index;
const crash = () => { throw new Error('interrupted'); };

// Even a successful retry cannot undo an invalid observation before a crash.
{
  const store = { current: { primary: 0, index: 0 } };
  const observed = [];
  assert.throws(() => publishSeparate(store, 1, () => {
    observed.push({ ...store.current });
    crash();
  }), /interrupted/);
  assert.equal(coherent(store.current), false, 'no automatic recovery occurs after interruption');
  publishSeparate(store, 1);
  assert.equal(coherent(store.current), true, 'an actual retry repairs final state');
  const completed = { ...store.current };
  publishSeparate(store, 1);
  assert.deepEqual(store.current, completed, 'the completed writes are repeatable');
  assert.equal(observed.every(coherent), false, 'final consistency does not erase earlier mixed-generation reads');
  results.set('publication-interruption', 'violation');
}

// Preparing a snapshot leaves the old state intact until one publication point.
{
  const store = { current: { primary: 0, index: 0 } };
  const original = store.current;
  const observed = [original];
  assert.throws(() => publishSnapshot(store, 1, crash), /interrupted/);
  assert.equal(store.current, original);
  publishSnapshot(store, 1, () => observed.push(store.current));
  observed.push(store.current);
  assert.ok(observed.every(coherent));
  assert.deepEqual(store.current, { primary: 1, index: 1 });
  results.set('snapshot-publication', 'satisfied');
}

// Fixed assignments from stale reads can lose a distinct accepted operation.
{
  const store = { current: { count: 0, version: 0 } };
  const first = prepareIncrement(store);
  const second = prepareIncrement(store);
  first();
  second();
  assert.equal(store.current.count, 1, 'two accepted increments lost one update');
  const repeated = { ...store.current };
  second();
  assert.deepEqual(store.current, repeated, 'the stale prepared write is individually repeatable');
  prepareIncrement(store)();
  assert.equal(store.current.count, 2);
  first();
  assert.equal(store.current.count, 1, 'replaying an old write erases newer work');
  results.set('concurrent-increments', 'violation');
}

// The caller actually retries a rejected stale attempt from a fresh observation.
{
  const store = { current: { count: 0, version: 0 } };
  const first = prepareConditionalIncrement(store);
  const second = prepareConditionalIncrement(store);
  assert.equal(first(), true);
  assert.equal(second(), false);
  assert.equal(store.current.count, 1);
  assert.equal(prepareConditionalIncrement(store)(), true);
  assert.equal(store.current.count, 2);
  assert.equal(first(), false, 'an old prepared writer remains rejected');
  assert.equal(store.current.count, 2);
  results.set('conditional-increments', 'satisfied');
}

// Partial progress is permitted by this contract; no cross-field invariant exists.
{
  const store = { cacheWarm: false, hintReady: false };
  const valid = () => typeof store.cacheWarm === 'boolean' && typeof store.hintReady === 'boolean';
  assert.throws(() => setIndependentHints(store, crash), /interrupted/);
  assert.deepEqual(store, { cacheWarm: true, hintReady: false });
  assert.ok(valid());
  setIndependentHints(store);
  assert.deepEqual(store, { cacheWarm: true, hintReady: true });
  setIndependentHints(store);
  assert.ok(valid());
  results.set('independent-hints', 'satisfied');
}

{
  const counters = new Map();
  upsertVisit(counters, 'same-delivery');
  upsertVisit(counters, 'same-delivery');
  assert.equal(counters.get('same-delivery'), 2, 'incrementing upsert conflict actions are not replay-safe');
  results.set('upsert-replay', 'violation');
}
assert.equal(key.cases.length, results.size);
assert.equal(new Set(key.cases.map(item => item.id)).size, results.size);
for (const item of key.cases) {
  assert.ok(item.requirement && item.mechanism);
  assert.equal(results.get(item.id), item.expected, `answer key disagrees with executable schedule: ${item.id}`);
}

// Prevent the specific unsafe policies from returning to active instructions.
const root = path.resolve(__dirname, '../..');
const changed = [
  'agents/_shared/builder-craft.md', 'agents/builder-consult.md', 'agents/builder-implement.md',
  'agents/builder-audit.md', 'agents/builder-review.md', 'agents/guardian-review.md',
  'agents/designer-review.md', 'agents/architect-review.md', 'commands/debate.md',
  '.agents/skills/debate/SKILL.md',
];
for (const file of changed) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  for (const banned of [
    /Flag missing transactions only when at least one mutation is non-idempotent/i,
    /must be wrapped in a transaction\. Partial writes = data corruption\. No exceptions/i,
    /Downgrade the transaction finding[^\n]*unconditionally/i,
    /If (?:ALL|every|all)[^\n]*idempotent[^\n]*(?:self-heal|downgrade|recoverable by retrying)/i,
    /transaction adds overhead without (?:atomicity|correctness) value/i,
  ]) assert.doesNotMatch(text, banned, `${file} reintroduces blanket atomicity guidance`);
}
const map = JSON.parse(fs.readFileSync(path.join(root, '.codex/agent-canonical-map.json'), 'utf8'));
let generated = 0;
for (const [file, entry] of Object.entries(map.agents)) {
  if (!changed.includes(entry.canonical)) continue;
  const canonical = fs.readFileSync(path.join(root, entry.canonical), 'utf8');
  assert.equal(entry.sha256, crypto.createHash('sha256').update(canonical).digest('hex'), `${file} canonical hash stale`);
  assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), buildStub(file, entry), `${file} differs from generated canonical definition`);
  generated++;
}
assert.ok(generated >= 7, 'affected generated reviewer and builder definitions must be checked');
assert.ok(map.agents['.codex/agents/architect-debate-judge.toml'].sections.includes('Atomicity and recovery'), 'debate judge must receive the corrected canonical check, not only a refreshed hash');
console.log(`atomicity guidance: ${results.size} executable cases; ${generated} generated definitions verified`);
