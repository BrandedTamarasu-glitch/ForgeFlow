export function createStore(backend) {
  let entries = {}, revision, ready = false;
  return {
    async reload() {
      const loaded = await backend.read();
      const v = loaded.value;
      entries = structuredClone(v.entries || v.items || {});
      revision = loaded.revision; ready = true;
    },
    snapshot() { if (!ready) throw new Error('not loaded'); return structuredClone(entries); },
    set(key, value) { if (!ready) throw new Error('not loaded'); entries[key] = value; },
    async flush() {
      if (!ready) throw new Error('not loaded');
      revision = (await backend.read()).revision;
      revision = await backend.write({ version: 2, entries: structuredClone(entries) }, revision);
    }
  };
}
