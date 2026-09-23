const { decode } = require('./format');
class Shelf {
  constructor(backend) { this.backend = backend; }
  async notes() { return decode(await this.backend.read(await this.backend.current())); }
  async append(id, text) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const head = await this.backend.current();
      const notes = decode(await this.backend.read(head));
      if (notes.some(note => note.id === id)) return { saved: true };
      const generation = await this.backend.stage(JSON.stringify({ schema: 2, notes: [...notes, { id, text }] }));
      if (await this.backend.publish(generation, head)) return { saved: true };
    }
    throw new Error('save conflict');
  }
  async sweep() {
    const ids = await this.backend.list();
    for (const id of ids) await this.backend.removeUnreferenced(id);
  }
}
module.exports = { Shelf };
