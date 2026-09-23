const { decode } = require('./format');
class Shelf {
  constructor(backend) { this.backend = backend; }
  async notes() { return decode(await this.backend.read(await this.backend.current())); }
  async append(id, text) {
    const notes = await this.notes();
    if (notes.some(note => note.id === id)) return { saved: true };
    const generation = await this.backend.stage(JSON.stringify({ schema: 2, notes: [...notes, { id, text }] }));
    await this.backend.publish(generation);
    return { saved: true };
  }
  async sweep() {
    const head = await this.backend.current();
    const ids = await this.backend.list();
    for (const id of ids) if (id !== head) await this.backend.remove(id);
  }
}
module.exports = { Shelf };
