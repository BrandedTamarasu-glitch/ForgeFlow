// Synthetic state-machine models, not database isolation implementations.
// The checkpoint represents an observable interruption between publication steps.
function publishSeparate(store, generation, checkpoint = () => {}) {
  store.current.primary = generation;
  checkpoint();
  store.current.index = generation;
}

function publishSnapshot(store, generation, checkpoint = () => {}) {
  const next = { primary: generation, index: generation };
  checkpoint();
  store.current = next;
}

function prepareIncrement(store) {
  const observed = { ...store.current };
  return () => {
    store.current = { count: observed.count + 1, version: observed.version + 1 };
  };
}

function prepareConditionalIncrement(store) {
  const observed = { ...store.current };
  return () => {
    if (store.current.version !== observed.version) return false;
    store.current = { count: observed.count + 1, version: observed.version + 1 };
    return true;
  };
}

function setIndependentHints(store, checkpoint = () => {}) {
  store.cacheWarm = true;
  checkpoint();
  store.hintReady = true;
}

// Model the conflict action of an upsert that increments an existing counter.
function upsertVisit(counters, key) {
  counters.set(key, (counters.get(key) || 0) + 1);
}

module.exports = {
  publishSeparate, publishSnapshot, prepareIncrement, prepareConditionalIncrement,
  setIndependentHints, upsertVisit,
};
