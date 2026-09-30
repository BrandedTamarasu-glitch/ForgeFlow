import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.mjs';
import { makeBackend } from '../backend.mjs';
test('publishes a record', async () => {
  const backend = makeBackend();
  assert.deepEqual(await new Store(backend).publish('memo-1', { title: 'Hello' }), { id: 'memo-1', payload: { title: 'Hello' } });
  assert.equal(backend.snapshot().commits, 1);
});
test('identical retry reuses durable publication', async () => {
  const backend = makeBackend(); const store = new Store(backend);
  await store.publish('memo-2', { title: 'Hello' });
  await store.publish('memo-2', { title: 'Hello' });
  assert.equal(backend.snapshot().commits, 1);
});
