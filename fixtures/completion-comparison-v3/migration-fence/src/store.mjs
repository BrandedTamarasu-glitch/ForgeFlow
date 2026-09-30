export function createStore(backend) {
  let entries = {}, revision, ready = false;
  return {
    async reload() {
      ready = false;
      const loaded = await backend.read();
      const v = loaded.value;
      if (!v || ![1, 2].includes(v.version)) throw new Error('unsupported version');
      const source = v.version === 1 ? v.items : v.entries;
      if (!source || typeof source !== 'object' ||
          ![Object.prototype, null].includes(Object.getPrototypeOf(source)) ||
          Object.values(source).some(x => typeof x !== 'string')) throw new Error('corrupt entries');
      entries = structuredClone(source); revision = loaded.revision; ready = true;
    },
    snapshot() { if (!ready) throw new Error('not loaded'); return structuredClone(entries); },
    set(key, value) {
      if (!ready) throw new Error('not loaded');
      if (typeof value !== 'string') throw new Error('invalid value');
      Object.defineProperty(entries, key, { value, enumerable: true, writable: true, configurable: true });
    },
    async flush() {
      if (!ready) throw new Error('not loaded');
      const next = { version: 2, entries: structuredClone(entries) };
      revision = await backend.write(next, revision);
    }
  };
}
