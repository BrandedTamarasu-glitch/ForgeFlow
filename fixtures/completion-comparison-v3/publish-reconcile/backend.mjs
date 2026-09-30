// Disposable deterministic seam. This file is outside the trial's edit scope.
export function makeBackend({ beforeCommit = async () => {}, loseAck = false } = {}) {
  const records = new Map();
  let commits = 0;
  return {
    async lookup(id) { return structuredClone(records.get(id)); },
    async commit(record) {
      await beforeCommit(record);
      if (records.has(record.id)) throw new Error('already exists');
      records.set(record.id, structuredClone(record));
      commits++;
      if (loseAck) throw new Error('acknowledgement lost');
      return structuredClone(record);
    },
    snapshot() { return { commits, records: structuredClone([...records.values()]) }; }
  };
}
