class Backend {
  constructor(initial = { schema: 2, notes: [] }) {
    this.head = 'g0'; this.blobs = new Map([['g0', JSON.stringify(initial)]]);
    this.sequence = 0; this.afterList = null; this.failRemove = false;
  }
  async current() { return this.head; }
  async read(id) { if (!this.blobs.has(id)) throw new Error('missing generation'); return this.blobs.get(id); }
  async stage(bytes) { const id = `g${++this.sequence}`; this.blobs.set(id, bytes); return id; }
  async publish(id, expected) {
    if (expected !== undefined && expected !== this.head) return false;
    if (!this.blobs.has(id)) throw new Error('missing generation');
    this.head = id; return true;
  }
  async list() { const ids = [...this.blobs.keys()]; if (this.afterList) { const hook = this.afterList; this.afterList = null; await hook(); } return ids; }
  async remove(id) { if (this.failRemove) throw new Error('removal failed'); this.blobs.delete(id); }
  async removeUnreferenced(id) {
    if (id === this.head) return false;
    if (this.failRemove) throw new Error('removal failed');
    this.blobs.delete(id); return true;
  }
}
module.exports = { Backend };
