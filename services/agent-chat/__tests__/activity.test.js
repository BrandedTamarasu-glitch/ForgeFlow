'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { once } = require('node:events');
const { WebSocket } = require('ws');
const { createAgentChatServer } = require('../server');
const { readToken } = require('../session-auth');
const { sendActivity } = require('../client');

async function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-activity-'));
  const tokenFile = path.join(dir, 'session.token');
  const service = createAgentChatServer({ agentPort: 0, dashboardPort: 0, tokenFile,
    autoSavePath: path.join(dir, 'chat.md'), logger: () => {} });
  await service.start();
  t.after(async () => { await service.stop(); fs.rmSync(dir, { recursive: true, force: true }); });
  const port = service.dashServer.address().port;
  const headers = { 'x-forgeflow-token': readToken(tokenFile) };
  function request(body, extra = headers, method = 'POST', endpoint = '/activity') {
    return new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port, path: endpoint, method, headers: extra }, res => {
        res.resume(); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers }));
      });
      req.on('error', reject); req.end(typeof body === 'string' ? body : JSON.stringify(body));
    });
  }
  async function dashboard() {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, { headers });
    t.after(() => ws.terminate());
    const init = JSON.parse((await once(ws, 'message'))[0]);
    return { ws, init };
  }
  return { service, port, tokenFile, headers, request, dashboard };
}

test('activity writes require agent credentials and validate bounded data', { timeout: 10000 }, async t => {
  const f = await fixture(t);
  const value = { agent: 'fc', state: 'implementing', label: 'Working 🔨' };
  assert.equal((await f.request(value, {})).status, 401);
  assert.equal((await f.request(value, { 'x-forgeflow-token': 'wrong' })).status, 401);
  assert.equal((await f.request(value, { ...f.headers, origin: 'https://foreign.invalid' })).status, 403);
  const index = await f.request(undefined, {}, 'GET', '/');
  const cookie = index.headers['set-cookie'][0].split(';')[0];
  assert.equal((await f.request(value, { cookie, origin: `http://127.0.0.1:${f.port}` })).status, 403);
  for (const invalid of ['{', null, [], {}, { ...value, agent: 'unknown' }, { ...value, state: 'offline' },
    { ...value, label: 'a'.repeat(161) }, { ...value, label: {} }]) {
    assert.equal((await f.request(invalid)).status, 400);
  }
  assert.equal((await f.request({ ...value, label: 'a'.repeat(3000) })).status, 413);
  assert.equal((await f.request(value)).status, 204);
  const beforeInvalid = (await f.dashboard()).init;
  for (const activityLabel of ['', ' ', 'x'.repeat(121), '\ninvalid', 'invalid\u0085', null, 7]) {
    assert.equal((await f.request({ agent: 'smith', state: 'failed', activityLabel })).status, 400);
    const afterInvalid = (await f.dashboard()).init;
    assert.deepEqual(afterInvalid.activity, beforeInvalid.activity);
    assert.deepEqual(afterInvalid.history, beforeInvalid.history);
  }
  const { init } = await f.dashboard();
  assert.equal(init.activity.agents.length, 1);
  assert.equal(init.activity.agents[0].label, value.label);
  assert.equal(init.activity.agents[0].state, 'implementing');
  assert.ok(Number.isFinite(init.activity.agents[0].updated_at));
  assert.deepEqual(init.history, []);
});

test('snapshots reach listeners and reconnects; agent identity and room reset are enforced', { timeout: 10000 }, async t => {
  const f = await fixture(t);
  const { ws, init } = await f.dashboard();
  assert.deepEqual(init.activity.agents, []);
  const next = once(ws, 'message');
  await f.request({ agent: 'fc', state: 'testing' });
  assert.equal(JSON.parse((await next)[0]).agents[0].state, 'testing');
  const agent = new WebSocket(`ws://127.0.0.1:${f.service.agentServer.address().port}`, { headers: f.headers });
  t.after(() => agent.terminate());
  await once(agent, 'open'); agent.send('compass'); await once(agent, 'message');
  agent.send(JSON.stringify({ type: 'activity', agent: 'fc', state: 'failed' }));
  const update = once(ws, 'message');
  agent.send(JSON.stringify({ agent: 'compass', level: 'phase', message: 'Structured lifecycle', activity: { state: 'reviewing', label: 'Review' } }));
  const snapshot = JSON.parse((await update)[0]);
  assert.deepEqual(snapshot.agents.map(a => a.state), ['testing', 'reviewing']);
  const reconnected = await f.dashboard();
  assert.deepEqual(reconnected.init.activity.agents, snapshot.agents);
  // Same-room joins preserve work; a new room starts with an empty snapshot.
  const reset = once(reconnected.ws, 'message');
  agent.send('/join ember-new-room');
  assert.deepEqual(JSON.parse((await reset)[0]).agents, []);
  assert.equal((await f.dashboard()).init.activity.room, 'ember-new-room');
});

test('optional reporter fails quietly without a credential or when disabled', async () => {
  assert.equal(await sendActivity('testing', 'Check', { tokenFile: '/nonexistent/ember-test.token' }), false);
});

test('aliases share activity slots and immutable message context survives replay and export', { timeout: 10000 }, async t => {
  const f = await fixture(t);
  const { ws } = await f.dashboard();
  const agent = new WebSocket(`ws://127.0.0.1:${f.service.agentServer.address().port}`, { headers: f.headers });
  t.after(() => agent.terminate());
  await once(agent, 'open'); agent.send('smith-review'); await once(agent, 'message');
  const body = 'Smith failed: <error> Warden\n  exact bytes';
  const delivered = once(ws, 'message');
  agent.send(JSON.stringify({ agent: 'fc', level: 'decision', message: body, activityLabel: '  Backend review  ' }));
  const event = JSON.parse((await delivered)[0]);
  assert.equal(event.agent, 'builder');
  assert.equal(event.activityLabel, 'Backend review');
  assert.equal(event.message, body);
  for (const alias of ['fc', 'smith', 'builder']) assert.equal((await f.request({ agent: alias, state: 'testing', label: alias })).status, 204);
  for (const activityLabel of ['', ' ', 'x'.repeat(121), '\ncontext', 'context\u0085', null, 7]) {
    agent.send(JSON.stringify({ agent: 'builder', level: 'phase', message: 'must not enter history', activityLabel, activity: { state: 'failed', label: 'must not change state' } }));
  }
  // A valid event on the same socket is the processing barrier for invalid sends.
  const barrier = new Promise(resolve => { const onMessage = raw => { const value = JSON.parse(raw); if (value.message === 'barrier') { ws.off('message', onMessage); resolve(value); } }; ws.on('message', onMessage); });
  agent.send(JSON.stringify({ agent: 'builder', level: 'phase', message: 'barrier' }));
  await barrier;
  const { init } = await f.dashboard();
  assert.equal(init.history.length, 2);
  assert.equal(init.history[0].activityLabel, 'Backend review');
  assert.equal(init.history[0].message, body);
  assert.equal(init.history[1].activityLabel, undefined);
  assert.equal(init.activity.agents.length, 1);
  assert.equal(init.activity.agents[0].agent, 'builder');
  assert.equal(init.activity.agents[0].state, 'testing');
  const exported = await fetch(`http://127.0.0.1:${f.port}/export`, { headers: f.headers }).then(res => res.text());
  assert.ok(exported.includes('Builder · Backend review'));
  assert.ok(exported.includes(body));
  assert.equal((await f.request(undefined, f.headers, 'GET', '/agent-identity.js')).status, 200);
  assert.equal((await f.request(undefined, {}, 'GET', '/agent-identity.js')).status, 401);
  for (const name of ['verifier', 'aegis', 'system']) assert.equal((await f.request({ agent: name, state: 'reviewing' })).status, 204);
  assert.equal((await f.dashboard()).init.activity.agents.length, 3);
});
