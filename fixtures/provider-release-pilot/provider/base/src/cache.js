function createCache(clock, maxAge) {
  const records = new Map();
  let sequence = 0;
  async function refresh(key, load) {
    const id = ++sequence;
    try {
      const payload = await load();
      if (!payload || payload.version !== 1 || !Number.isFinite(payload.value) || !Number.isFinite(payload.observedAt) || payload.observedAt < 0 || payload.observedAt > clock()) throw new Error('invalid');
      if (id === sequence) records.set(key, { value: payload.value, observedAt: payload.observedAt, error: null });
    } catch (error) {
      records.set(key, { value: null, observedAt: clock(), error: error.message });
    }
  }
  function view(key) {
    const record = records.get(key) || { value: null, observedAt: null, error: null };
    return { ...record, freshness: record.value === null ? 'missing' : clock() - record.observedAt <= maxAge ? 'fresh' : 'stale' };
  }
  return { refresh, view };
}
module.exports = { createCache };
