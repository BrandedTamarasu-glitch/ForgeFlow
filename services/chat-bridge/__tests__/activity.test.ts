import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { handleRequest } from '../bridge.ts';
import type { ChatMessage } from '../types.ts';
import type { ConnectionPool } from '../connections.ts';
import { VALID_AGENTS, ACTIVITY_STATES, parseLifecycleRequest, parseSendRequest } from '../types.ts';

test('lifecycle activity is optional, structured, and restricted to known states', () => {
  const base = { event: 'phase-start', agent: 'compass', data: 'Planning the feature' };
  assert.ok(parseLifecycleRequest(base));
  assert.equal(parseLifecycleRequest(base)?.state, undefined);
  for (const state of ACTIVITY_STATES) assert.equal(parseLifecycleRequest({ ...base, state })?.state, state);
  for (const state of ['offline', 'made-up', null, 1, {}, []]) assert.equal(parseLifecycleRequest({ ...base, state }), null);
});

test('send and lifecycle normalize known roles and validate immutable context', () => {
  for (const [input, output] of [['fc', 'builder'], ['smith-review', 'builder'], ['product-lead-planner', 'product_lead'], ['aegis', 'verifier'], ['system', 'system']]) {
    const body = { agent: input, level: 'phase', message: 'Warden: <exact>\n', activityLabel: '  Security review  ' };
    assert.deepEqual(parseSendRequest(body), { ...body, agent: output, activityLabel: 'Security review' });
    assert.equal(parseLifecycleRequest({ event: 'start', agent: input, activityLabel: 'Review' })?.agent, output);
  }
  for (const activityLabel of ['', ' ', 'x'.repeat(121), 'line\nbreak', 'control\u0085', null, {}, 1]) {
    assert.equal(parseSendRequest({ agent: 'builder', level: 'phase', message: 'test', activityLabel }), null);
    assert.equal(parseLifecycleRequest({ event: 'start', activityLabel }), null);
  }
  assert.equal(parseSendRequest({ agent: 'custom', level: 'phase', message: 'test' }), null);
  assert.equal(parseLifecycleRequest({ event: 'start', agent: 'custom' }), null);
});

test('HTTP bridge preserves context and rejects invalid metadata before pool or state changes', async t => {
  const sent: ChatMessage[] = [];
  const pool: ConnectionPool = {
    connect: async () => {}, send: message => { sent.push(message); return true; }, joinRoom: () => {},
    getStatus: () => Object.fromEntries(VALID_AGENTS.map(agent => [agent, 'connected'])) as ReturnType<ConnectionPool['getStatus']>,
    getQueuedCount: () => 0, shutdown: async () => {},
  };
  const state = { verbosity: 'conversation' as const, currentRoom: 'test-room' };
  const server = http.createServer((req, res) => { void handleRequest(req, res, pool, state, 'fixture-token'); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const post = (endpoint: string, body: unknown) => fetch(`http://127.0.0.1:${address.port}${endpoint}`, {
    method: 'POST', headers: { 'x-forgeflow-token': 'fixture-token', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const message = 'Smith: <error>\n  Warden exact text';
  assert.equal((await post('/send', { agent: 'smith-review', level: 'decision', message, activityLabel: '  Backend review  ' })).status, 200);
  assert.equal(sent[0]?.agent, 'builder');
  assert.equal(sent[0]?.activityLabel, 'Backend review');
  assert.equal(sent[0]?.message, message);
  assert.equal((await post('/lifecycle', { event: 'start', state: 'testing', activityLabel: 'Test suite' })).status, 200);
  assert.equal(sent[1]?.agent, 'system');
  assert.equal(sent[1]?.activityLabel, 'Test suite');
  assert.equal(sent[1]?.activity?.state, 'testing');
  for (const endpoint of ['/send', '/lifecycle']) {
    assert.equal((await post(endpoint, { agent: 'builder', event: 'bad', state: 'failed', level: 'phase', message, activityLabel: '\ninvalid' })).status, 400);
  }
  assert.equal(sent.length, 2);
});
