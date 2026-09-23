// Synthetic byte-store model. Each method is one indivisible scheduled operation.
// It models reload and explicit interleavings, not filesystem/power-loss guarantees.
function createStore(document = { schema: 1, entries: ['seed'] }) {
  return { head: 'g0', blobs: { g0: JSON.stringify(document) }, pending: new Set(), readers: new Set() };
}
function restart(store) {
  return { ...JSON.parse(JSON.stringify({ head: store.head, blobs: store.blobs })), pending: new Set(), readers: new Set() };
}
function decode(bytes, supported = [1, 2]) {
  const document = JSON.parse(bytes);
  if (!supported.includes(document.schema)) throw new Error('unsupported schema');
  const values = document.schema === 1 ? document.entries : document.items;
  if (!Array.isArray(values) || !values.every(value => typeof value === 'string')) throw new Error('invalid values');
  return { schema: document.schema, values: [...values] };
}
function read(store, generation = store.head, supported) {
  return decode(store.blobs[generation], supported);
}
function stage(store, generation, document, fault) {
  if (Object.hasOwn(store.blobs, generation)) throw new Error('generation already exists');
  store.pending.add(generation);
  const bytes = JSON.stringify(document);
  store.blobs[generation] = fault ? bytes.slice(0, 8) : bytes;
  if (fault) throw new Error(fault);
}
function publish(store, generation, expectedHead, guarded = true) {
  read(store, generation);
  if (guarded && store.head !== expectedHead) return false;
  store.head = generation;
  store.pending.delete(generation);
  return true;
}
function candidates(store) {
  return Object.keys(store.blobs).filter(id => id !== store.head);
}
function reclaim(store, generation, { guarded = true, fail = false } = {}) {
  // Reachability test AND deletion form a single protected model operation.
  if (guarded && (generation === store.head || store.pending.has(generation) || store.readers.has(generation))) return 'protected';
  if (fail) return 'removal-failed';
  delete store.blobs[generation];
  return 'removed';
}
module.exports = { createStore, restart, read, stage, publish, candidates, reclaim };
