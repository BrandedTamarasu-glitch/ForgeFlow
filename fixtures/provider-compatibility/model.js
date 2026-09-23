// Checkout-only fictional protocol and aggregation model, not a runtime adapter.
function normalize(body, now) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || ![1, 2].includes(body.version) || (body.complete !== undefined && body.complete !== true)) throw new Error('invalid-response');
  const value = body.version === 1 ? body.value : body.reading;
  const observed = body.version === 1 ? body.observedAt : body.sampled_at;
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isSafeInteger(observed) || observed < 0 || observed > now) throw new Error('invalid-response');
  return { value, observed_at: observed };
}
function createModel(clock, maxAge = 100) {
  const states = new Map();
  function start(id, transport) {
    const previous = states.get(id);
    if (previous?.pending) previous.cancel();
    const state = { data: previous?.data || null, pending: true, reason: null };
    const controller = new AbortController();
    let timer;
    function finish(reason, data) {
      if (!state.pending || states.get(id) !== state) return;
      state.pending = false; state.reason = reason;
      if (data) state.data = data;
      clock.clear(timer);
      if (reason === 'timeout' || reason === 'cancelled') controller.abort();
    }
    state.cancel = () => finish('cancelled');
    states.set(id, state);
    timer = clock.schedule(() => finish('timeout'), 50);
    // Convert synchronous throws and asynchronous rejections to bounded codes.
    Promise.resolve().then(() => state.pending && states.get(id) === state ? transport(controller.signal) : undefined).then(body => {
      if (!state.pending || states.get(id) !== state) return;
      try { finish(null, normalize(body, clock.now())); }
      catch { finish('invalid-response'); }
    }, () => finish('provider-failed'));
    return state.cancel;
  }
  function view(id) {
    const state = states.get(id);
    if (!state) return { status: 'unavailable', reason: 'not-requested', data: null };
    const data = state.data ? { ...state.data } : null;
    const stale = data && (state.reason !== null || clock.now() - data.observed_at > maxAge);
    return { status: data ? stale ? 'stale' : state.pending ? 'refreshing' : 'ready' : state.pending ? 'loading' : 'unavailable', reason: state.reason, data };
  }
  return { start, view };
}
module.exports = { normalize, createModel };
