// Store document entry dictionaries use Object.prototype or null prototypes and own string-valued keys.
// Backend clones opaque documents without validating them; the store owns version and dictionary validation.
export function backend(initial) {
  let value = structuredClone(initial), revision = 0, fault = false, gate;
  return {
    async read() { return { value: structuredClone(value), revision }; },
    async write(next, expected) {
      if (gate) { const g = gate; gate = undefined; g.enter(); await g.wait; }
      if (fault) { fault = false; throw new Error('write fault'); }
      if (expected !== revision) throw new Error('stale writer');
      value = structuredClone(next); revision++; return revision;
    },
    failNextWrite() { fault = true; },
    pauseNextWrite() {
      let enter, release;
      const entered = new Promise(r => { enter = r; });
      const wait = new Promise(r => { release = r; });
      gate = { enter, wait }; return { entered, release };
    },
    inspect() { return { value: structuredClone(value), revision }; }
  };
}
