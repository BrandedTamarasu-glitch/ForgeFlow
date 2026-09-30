import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { Store } from '../completion-comparison-v3/publish-reconcile/src/store.mjs';
import { makeBackend } from '../completion-comparison-v3/publish-reconcile/backend.mjs';

// Post-freeze diagnostic only: reference inputs and primary scores stay fixed.
const persistence = makeBackend();
const store = new Store(persistence);
const buffer = new SharedArrayBuffer(1);
new Uint8Array(buffer)[0] = 1;
const record = await store.publish('shared', { buffer });
const storedByte = () => new Uint8Array(persistence.snapshot().records[0].payload.buffer)[0];
assert.equal(storedByte(), 1);
new Uint8Array(buffer)[0] = 2;
assert.equal(storedByte(), 2);
new Uint8Array(record.payload.buffer)[0] = 3;
assert.equal(storedByte(), 3);
assert.equal(persistence.snapshot().commits, 1);

let signalEntered, release;
const entered = new Promise(resolve => { signalEntered = resolve; });
const wait = new Promise(resolve => { release = resolve; });
const delayed = makeBackend({ beforeCommit: async () => { signalEntered(); await wait; } });
const pendingBuffer = new SharedArrayBuffer(1);
new Uint8Array(pendingBuffer)[0] = 1;
const publication = new Store(delayed).publish('entry-capture', { buffer: pendingBuffer });
await entered;
new Uint8Array(pendingBuffer)[0] = 9;
release();
const published = await publication;
assert.equal(new Uint8Array(published.payload.buffer)[0], 9);
assert.equal(new Uint8Array(delayed.snapshot().records[0].payload.buffer)[0], 9);

const first = new Error('same');
const second = new Error('same');
first.stack = 'stack-one';
second.stack = 'stack-two';
const left = structuredClone(first), right = structuredClone(second);
assert.notEqual(left.stack, right.stack);
assert.equal(isDeepStrictEqual(left, right), true);
console.log(JSON.stringify({
  diagnostic: 'post-freeze-only',
  caller_and_returned_mutation_change_stored_bytes: true,
  call_entry_byte: 1,
  byte_published_after_barrier: 9,
  extra_commits: 0,
  scope: 'In-memory shared backing store; no disk durability claim.',
  error_stack_equality: 'Different cloned stacks compare equal; task semantics for stack equality are unspecified.',
}));
