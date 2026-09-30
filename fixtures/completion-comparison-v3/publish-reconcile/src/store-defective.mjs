export class Store {
  constructor(backend) { this.backend = backend; }
  async publish(id, payload) {
    const existing = await this.backend.lookup(id);
    if (existing) return existing;
    return this.backend.commit({ id, payload });
  }
}
