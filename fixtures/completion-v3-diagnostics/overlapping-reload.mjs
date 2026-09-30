import assert from 'node:assert/strict';
import { createStore } from '../completion-comparison-v3/migration-fence/src/store.mjs';
import { backend } from '../completion-comparison-v3/migration-fence/backend.mjs';

// Post-freeze diagnostic only. Never changes the frozen oracle or trial scores.
const persistence = backend({ version: 2, entries: { a: 'A' } });
const store = createStore(persistence);
await store.reload();
const earlier = store.reload();
const publication = persistence.write({ version: 99, entries: {} }, 0);
const later = store.reload().then(
  () => ({ rejected: false }),
  error => ({ rejected: true, message: error.message }),
);
await Promise.all([earlier, publication]);
const failure = await later;
assert.deepEqual(failure, { rejected: true, message: 'unsupported version' });
assert.deepEqual(store.snapshot(), { a: 'A' });
store.set('b', 'B');
assert.deepEqual(store.snapshot(), { a: 'A', b: 'B' });
await assert.rejects(store.flush(), /stale writer/);
assert.deepEqual(persistence.inspect(), { value: { version: 99, entries: {} }, revision: 1 });
console.log(JSON.stringify({
  diagnostic: 'post-freeze-only',
  later_reload_rejected: true,
  earlier_state_remains_accessible: true,
  local_edit_permitted: true,
  durable_future_document_preserved: true,
  limit: 'Same-instance overlapping reloads are not explicitly specified; failed-reload invalidation is unconditional in the task.',
}));
