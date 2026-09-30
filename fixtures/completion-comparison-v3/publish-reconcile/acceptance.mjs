import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { makeBackend } from './backend.mjs';
const { Store } = await import(pathToFileURL(resolve(process.argv[2] || '.', 'src/store.mjs')));
const checks = [];
async function check(id, run) {
  try { await run(); checks.push({ id, pass: true }); }
  catch (error) { checks.push({ id, pass: false, error: error.message }); }
}
function barrier() {
  let release; let entered;
  const ready = new Promise(r => { entered = r; });
  const gate = new Promise(r => { release = r; });
  return { ready, release, async wait() { entered(); await gate; } };
}
await check('ordinary-publication', async () => {
  const backend = makeBackend();
  assert.deepEqual(await new Store(backend).publish('memo', { n: 1 }), { id: 'memo', payload: { n: 1 } });
});
await check('canonical-alias-retry', async () => {
  const backend = makeBackend(); const store = new Store(backend);
  await store.publish(' Memo_A ', { n: 1 });
  assert.equal((await store.publish('memo_a', { n: 1 })).id, 'memo_a');
  assert.equal(backend.snapshot().commits, 1);
});
await check('invalid-before-storage', async () => {
  let touches = 0;
  const store = new Store({ async lookup() { touches++; }, async commit() { touches++; } });
  for (const id of ['', ' ', '../memo', '-memo', 'a'.repeat(65), null, 3, 'mémo']) await assert.rejects(store.publish(id, {}));
  assert.equal(touches, 0);
});
await check('legacy-uuid-compatibility', async () => {
  const id = '8b6ac2ed-7320-4cef-b676-4c067d88ec25';
  assert.equal((await new Store(makeBackend()).publish(id, {})).id, id);
});
await check('lost-ack-reconciled', async () => {
  const gate = barrier(); const backend = makeBackend({ loseAck: true, beforeCommit: () => gate.wait() });
  const store = new Store(backend); const result = store.publish('memo', { n: 1 });
  // Attach immediately so deliberately defective sources cannot emit unhandled rejections.
  const observed = result.then(value => ({ value }), error => ({ error }));
  await gate.ready; gate.release();
  const settled = await observed;
  assert.ifError(settled.error); assert.equal(settled.value.payload.n, 1);
  await store.publish('memo', { n: 1 });
  assert.equal(backend.snapshot().commits, 1);
});
await check('concurrent-identical-retry', async () => {
  const gate = barrier(); const backend = makeBackend({ beforeCommit: () => gate.wait() }); const store = new Store(backend);
  const first = store.publish('memo', { n: 1 }); const second = store.publish('memo', { n: 1 });
  const observed = Promise.allSettled([first, second]);
  await gate.ready; gate.release();
  const results = await observed;
  assert.deepEqual(results.map(r => r.status), ['fulfilled', 'fulfilled']);
  assert.equal(backend.snapshot().commits, 1);
});
await check('conflicting-retry', async () => {
  const backend = makeBackend(); const store = new Store(backend);
  await store.publish('memo', { n: 1 });
  await assert.rejects(store.publish('memo', { n: 2 }), /conflict/);
  assert.equal(backend.snapshot().records[0].payload.n, 1);
});
await check('concurrent-conflict', async () => {
  const gate = barrier(); const backend = makeBackend({ beforeCommit: () => gate.wait() }); const store = new Store(backend);
  const observed = Promise.allSettled([store.publish('memo', { n: 1 }), store.publish('memo', { n: 2 })]);
  await gate.ready; gate.release();
  const results = await observed;
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const rejected = results.find(r => r.status === 'rejected');
  assert.match(rejected.reason.message, /conflict/);
  assert.equal(backend.snapshot().commits, 1);
});
await check('object-order-compatibility', async () => {
  const backend = makeBackend(); const store = new Store(backend);
  await store.publish('memo', { a: 1, b: 2 });
  assert.deepEqual((await store.publish('memo', { b: 2, a: 1 })).payload, { a: 1, b: 2 });
  assert.equal(backend.snapshot().commits, 1);
});
await check('nested-collection-compatibility-and-conflict', async () => {
  const backend = makeBackend(); const store = new Store(backend);
  const payload = () => ({ collection: new Map([['entry', new Set([1, 2])]]), date: new Date('2025-01-01T00:00:00Z') });
  await store.publish('memo', payload());
  assert.deepEqual((await store.publish('memo', payload())).payload, payload());
  const different = payload(); different.collection.set('entry', new Set([1, 3]));
  await assert.rejects(store.publish('memo', different), /conflict/);
  assert.equal(backend.snapshot().commits, 1);
});
await check('cyclic-detached-retry', async () => {
  const backend = makeBackend(); const store = new Store(backend);
  const payload = { n: 1 }; payload.self = payload;
  const record = await store.publish('memo', payload);
  assert.equal(record.payload.self, record.payload);
  record.payload.n = 7;
  const retry = await store.publish('memo', payload);
  assert.equal(retry.payload.n, 1);
  assert.equal(retry.payload.self, retry.payload);
  assert.equal(backend.snapshot().commits, 1);
});
await check('payload-captured-before-barrier', async () => {
  const gate = barrier(); const backend = makeBackend({ beforeCommit: () => gate.wait() });
  const payload = { nested: { n: 1 } }; const result = new Store(backend).publish('memo', payload);
  const observed = result.then(value => ({ value }), error => ({ error }));
  await gate.ready; payload.nested.n = 2; gate.release();
  const settled = await observed; assert.ifError(settled.error); assert.equal(settled.value.payload.nested.n, 1);
});
await check('detached-return', async () => {
  const backend = makeBackend(); const store = new Store(backend);
  const record = await store.publish('memo', { nested: { n: 1 } }); record.payload.nested.n = 9;
  assert.equal((await store.publish('memo', { nested: { n: 1 } })).payload.nested.n, 1);
});
await check('precommit-failure-propagated', async () => {
  const backend = makeBackend({ beforeCommit: async () => { throw new Error('offline'); } });
  await assert.rejects(new Store(backend).publish('memo', {}), /offline/);
  assert.equal(backend.snapshot().commits, 0);
});
const pass = checks.every(check => check.pass);
console.log(JSON.stringify({ pass, checks }));
process.exitCode = pass ? 0 : 1;
