'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { deriveActivity, STALE_MS } = require('../public/ember');
const now = 200000;
const agent = (state, age = 0, name = 'fc') => ({ agent: name, state, label: `${state} work`, updated_at: now - age });
const derive = agents => deriveActivity({ agents }, true, now);

test('disconnection, missing snapshot, and idle are distinct', () => {
  assert.equal(deriveActivity({ agents: [agent('testing')] }, false, now).state, 'offline');
  assert.equal(deriveActivity(null, true, now).state, 'waiting');
  assert.equal(derive([]).state, 'idle');
});
test('explicit failure and waiting take precedence across active agents', () => {
  assert.equal(derive([agent('implementing'), agent('waiting', 0, 'compass')]).state, 'waiting');
  assert.equal(derive([agent('testing'), agent('failed', 0, 'warden')]).state, 'failed');
  assert.equal(derive([agent('complete'), agent('reviewing', 0, 'arbiter')]).state, 'reviewing');
});
test('stale work waits for an update and never becomes success or idle', () => {
  const result = derive([agent('testing', STALE_MS + 1)]);
  assert.equal(result.state, 'waiting');
  assert.equal(result.stale, true);
  assert.match(result.label, /last reported testing/);
  assert.equal(derive([agent('failed', STALE_MS + 1), agent('implementing')]).state, 'implementing');
  assert.equal(derive([agent('complete', STALE_MS + 1)]).state, 'complete');
});
test('invalid activity is ignored and matching states use the latest report', () => {
  assert.equal(derive([null, { agent: 'fc', state: 'testing' }, agent('invented')]).state, 'idle');
  assert.equal(derive([{ ...agent('testing', 10), label: 'older' }, { ...agent('testing'), label: 'newer' }]).label, 'newer');
});
