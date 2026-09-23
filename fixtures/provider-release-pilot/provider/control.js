function createCache(clock, maxAge) {
  const records = new Map();
  const sequences = new Map();
  async function refresh(key, load) {
    const id = (sequences.get(key) || 0) + 1;
    sequences.set(key, id);
    try {
      const payload = await load();
      if (!payload || payload.version !== 1 || !Number.isFinite(payload.value) || !Number.isFinite(payload.observedAt) || payload.observedAt < 0 || payload.observedAt > clock()) throw new Error('invalid');
      if (id === sequences.get(key)) records.set(key, { value: payload.value, observedAt: payload.observedAt, error: null });
    } catch {
      if (id === sequences.get(key)) records.set(key, { ...(records.get(key) || { value: null, observedAt: null }), error: 'refresh-failed' });
    }
  }
  function view(key) {
    const record = records.get(key) || { value: null, observedAt: null, error: null };
    return { ...record, freshness: record.value === null ? 'missing' : clock() - record.observedAt <= maxAge ? 'fresh' : 'stale' };
  }
  return { refresh, view };
}
module.exports = { createCache };
