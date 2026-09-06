import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITY_STATES, parseLifecycleRequest } from '../types.ts';

test('lifecycle activity is optional, structured, and restricted to known states', () => {
  const base = { event: 'phase-start', agent: 'compass', data: 'Planning the feature' };
  assert.ok(parseLifecycleRequest(base));
  assert.equal(parseLifecycleRequest(base)?.state, undefined);
  for (const state of ACTIVITY_STATES) assert.equal(parseLifecycleRequest({ ...base, state })?.state, state);
  for (const state of ['offline', 'made-up', null, 1, {}, []]) assert.equal(parseLifecycleRequest({ ...base, state }), null);
});
