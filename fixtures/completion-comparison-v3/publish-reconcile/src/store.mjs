import { isDeepStrictEqual } from 'node:util';
export class Store {
  constructor(backend) { this.backend = backend; }
  async publish(id, payload) {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id.trim())) throw new Error('invalid id');
    const key = id.trim().toLowerCase();
    const record = { id: key, payload: structuredClone(payload) };
    const resolve = existing => {
      if (!isDeepStrictEqual(existing.payload, record.payload)) throw new Error('payload conflict');
      return structuredClone(existing);
    };
    const existing = await this.backend.lookup(key);
    if (existing) return resolve(existing);
    try { return await this.backend.commit(record); }
    catch (error) {
      const durable = await this.backend.lookup(key);
      if (durable) return resolve(durable);
      throw error;
    }
  }
}
