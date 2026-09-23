#!/usr/bin/env node
const assert = require('node:assert/strict');
const { normalize, createModel } = require('../../fixtures/provider-compatibility/model');
const corpus = require('../../fixtures/provider-compatibility/corpus.json');
function clock() {
  let time = 1000, next = 0; const timers = new Map();
  return { now: () => time, schedule: (fn, delay) => { const id = ++next; timers.set(id, { fn, at: time + delay }); return id; }, clear: id => timers.delete(id),
    advance: duration => { time += duration; for (const [id, timer] of [...timers]) if (timer.at <= time) { timers.delete(id); timer.fn(); } }, pending: () => timers.size };
}
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const drain = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };
const payload = (value, observedAt = 1000) => ({ version: 1, value, observedAt });
async function main() {
  for (const item of corpus.cases) {
    if (item.expected) assert.deepEqual(normalize(item.payload, 1000), item.expected, item.id);
    else assert.throws(() => normalize(item.payload, 1000), /invalid-response/, item.id);
  }
  assert.throws(() => normalize(payload(Infinity), 1000), /invalid-response/);
  assert.throws(() => normalize(payload(NaN), 1000), /invalid-response/);
  assert.throws(() => normalize('{"version":', 1000), /invalid-response/);
  assert.throws(() => normalize([], 1000), /invalid-response/);
  const time = clock(), model = createModel(time);
  let calls = 0;
  const immediate = model.start('immediate', async () => { calls++; return payload(1); });
  immediate(); immediate(); await drain();
  assert.equal(calls, 0, 'cancel before transport launch avoids starting work');
  assert.equal(model.view('immediate').reason, 'cancelled');
  assert.equal(model.view('a').reason, 'not-requested');
  const sentinel = 'SYNTHETIC_PRIVATE_SENTINEL_NOT_A_CREDENTIAL';
  model.start('a', async () => ({ ...payload(12), ignored: sentinel }));
  model.start('b', async () => { throw new Error(sentinel); });
  await drain();
  assert.deepEqual(model.view('a'), { status: 'ready', reason: null, data: { value: 12, observed_at: 1000 } });
  assert.deepEqual(model.view('b'), { status: 'unavailable', reason: 'provider-failed', data: null });
  assert.ok(!JSON.stringify([model.view('a'), model.view('b')]).includes(sentinel));
  const detached = model.view('a'); detached.data.value = 999;
  assert.equal(model.view('a').data.value, 12, 'callers cannot mutate cached data through output');
  time.advance(100); assert.equal(model.view('a').status, 'ready');
  time.advance(1); assert.equal(model.view('a').status, 'stale');

  const late = deferred(); let signal;
  model.start('a', received => { signal = received; return late.promise; });
  await drain(); time.advance(50);
  assert.equal(signal.aborted, true); assert.equal(model.view('a').reason, 'timeout');
  assert.equal(model.view('a').data.observed_at, 1000, 'failed refresh cannot freshen cached data');
  late.resolve(payload(99, time.now())); await drain();
  assert.equal(model.view('a').data.value, 12, 'late timeout result cannot publish');

  const cancelled = deferred();
  const cancel = model.start('b', received => { signal = received; return cancelled.promise; });
  await drain(); cancel(); assert.equal(signal.aborted, true);
  assert.equal(model.view('b').reason, 'cancelled');
  cancelled.resolve(payload(80, time.now())); await drain(); assert.equal(model.view('b').data, null);

  const old = deferred();
  model.start('a', () => old.promise); await drain();
  model.start('a', async () => ({ version: 2, reading: 20, sampled_at: time.now() })); await drain();
  const current = model.view('a');
  old.reject(new Error(sentinel)); await drain();
  assert.deepEqual(model.view('a'), current, 'old rejection cannot corrupt replacement result');
  assert.equal(current.status, 'ready'); assert.equal(current.data.value, 20);
  const outdated = deferred();
  model.start('b', () => outdated.promise); await drain();
  model.start('b', async () => payload(40, time.now())); await drain();
  outdated.resolve(payload(999, time.now())); await drain();
  assert.equal(model.view('b').data.value, 40, 'superseded successful response cannot replace the current one');
  model.start('b', () => { throw new Error(sentinel); }); await drain();
  assert.deepEqual(model.view('a'), current, 'another provider failure stays isolated');
  model.start('a', async () => ({ version: 2, reading: 42, complete: false, debug: sentinel })); await drain();
  assert.deepEqual(model.view('a'), { status: 'stale', reason: 'invalid-response', data: current.data });
  assert.ok(!JSON.stringify(model.view('a')).includes(sentinel));
  model.start('a', async () => payload(30, time.now())); await drain();
  assert.equal(model.view('a').status, 'ready'); assert.equal(model.view('a').data.value, 30);
  assert.equal(time.pending(), 0, 'completed/cancelled requests release model timers');
  console.log(`provider compatibility: ${corpus.cases.length} versioned payload cases plus isolation, freshness, timeout, cancellation and late-response schedules passed (synthetic only)`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
