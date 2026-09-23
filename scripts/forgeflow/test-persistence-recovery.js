#!/usr/bin/env node
const assert = require('node:assert/strict');
const { createStore, restart, read, stage, publish, candidates, reclaim } = require('../../fixtures/persistence-recovery/operations');
const key = require('../../fixtures/persistence-recovery/answer-key.json');
const results = new Map();
const document = values => ({ schema: 2, items: values });
const loaded = store => read(restart(store)).values;

{
  const store = createStore();
  store.blobs[store.head] = '{"schema'; // Interrupted direct overwrite.
  assert.throws(() => loaded(store), SyntaxError);
  results.set('direct-overwrite', 'violation');
}
for (const fault of ['interrupted', 'quota-exceeded']) {
  const store = createStore();
  assert.throws(() => stage(store, 'g1', document(['seed', 'new']), fault), new RegExp(fault));
  assert.deepEqual(loaded(store), ['seed']);
  assert.throws(() => publish(store, 'g1', 'g0'), SyntaxError);
  results.set(fault, 'satisfied');
}
{
  const store = createStore();
  stage(store, 'g1', document(['seed', 'new']));
  assert.deepEqual(loaded(store), ['seed'], 'completed staging is not publication');
  assert.equal(publish(store, 'g1', 'g0'), true);
  assert.deepEqual(loaded(store), ['seed', 'new'], 'publication survives lost acknowledgement');
  results.set('publication-boundary', 'satisfied');
}
for (const guarded of [false, true]) {
  const store = createStore();
  const observed = read(store).values;
  stage(store, 'writer-a', document([...observed, 'a']));
  stage(store, 'writer-b', document([...observed, 'b']));
  assert.equal(publish(store, 'writer-a', 'g0', guarded), true);
  assert.equal(publish(store, 'writer-b', 'g0', guarded), !guarded);
  if (guarded) {
    assert.deepEqual(loaded(store), ['seed', 'a']);
    stage(store, 'writer-b-rebased', document([...read(store).values, 'b']));
    assert.equal(publish(store, 'writer-b-rebased', 'writer-a'), true);
    assert.deepEqual(loaded(store), ['seed', 'a', 'b']);
    assert.equal(publish(store, 'writer-b', 'g0'), false, 'stale retry cannot erase later commits');
  } else assert.deepEqual(loaded(store), ['seed', 'b'], 'acknowledged a was lost');
  results.set(guarded ? 'stale-writer-rebase' : 'stale-writer-loss', guarded ? 'satisfied' : 'violation');
}
for (const guarded of [false, true]) {
  const store = createStore();
  stage(store, 'g1', document(['seed', 'new']));
  const discovered = candidates(store);
  assert.deepEqual(discovered, ['g1']);
  assert.equal(publish(store, 'g1', 'g0'), true); // Cleanup's list becomes stale.
  assert.equal(reclaim(store, discovered[0], { guarded }), guarded ? 'protected' : 'removed');
  if (guarded) assert.deepEqual(loaded(store), ['seed', 'new']);
  else assert.throws(() => loaded(store), SyntaxError);
  results.set(guarded ? 'protected-cleanup' : 'committed-data-deletion', guarded ? 'satisfied' : 'violation');
}
{
  const store = createStore();
  store.readers.add('g0'); // One reader pins an old snapshot.
  stage(store, 'g1', document(['seed', 'new']));
  assert.equal(reclaim(store, 'g1'), 'protected', 'pending writer protected');
  publish(store, 'g1', 'g0');
  assert.equal(reclaim(store, 'g0'), 'protected', 'old reader protected');
  assert.deepEqual(read(store, 'g0').values, ['seed']);
  assert.notEqual('g0', store.head, 'reader identity exposes staleness');
  store.readers.delete('g0');
  assert.equal(reclaim(store, 'g0', { fail: true }), 'removal-failed');
  assert.deepEqual(loaded(store), ['seed', 'new']);
  assert.equal(reclaim(store, 'g0'), 'removed');
  assert.deepEqual(loaded(store), ['seed', 'new']);
  results.set('reader-and-removal-failure', 'satisfied');
}
{
  const store = createStore({ schema: 1, entries: ['seed', 'preserved'] });
  stage(store, 'migrated', document(read(store).values));
  assert.equal(read(restart(store)).schema, 1, 'interrupted migration leaves old format readable');
  publish(store, 'migrated', 'g0');
  const restored = restart(store);
  assert.equal(read(restored).schema, 2);
  assert.deepEqual(read(restored).values, ['seed', 'preserved']);
  const before = JSON.stringify(restored.blobs);
  assert.throws(() => read(restored, restored.head, [1]), /unsupported schema/);
  assert.equal(JSON.stringify(restored.blobs), before, 'old reader cannot silently normalize new data');
  stage(store, 'stale-old', { schema: 1, entries: ['stale'] });
  assert.equal(publish(store, 'stale-old', 'g0'), false, 'pre-migration writer rejected');
  assert.deepEqual(loaded(store), ['seed', 'preserved']);
  results.set('schema-migration', 'satisfied');
}
for (const bytes of ['{"schema":99,"items":["future"]}', '{"schema":2,"items":null}']) {
  const store = createStore();
  store.blobs.g0 = bytes;
  assert.throws(() => loaded(store), /unsupported schema|invalid values/);
  assert.equal(store.blobs.g0, bytes, 'unsupported/corrupt data stays intact for recovery');
}
results.set('unsupported-no-write', 'satisfied');
assert.equal(results.size, key.cases.length);
assert.equal(new Set(key.cases.map(item => item.id)).size, results.size);
for (const item of key.cases) assert.equal(results.get(item.id), item.expected, item.id);
console.log(`persistence recovery: ${results.size} deterministic schedules passed; synthetic reload model only`);
