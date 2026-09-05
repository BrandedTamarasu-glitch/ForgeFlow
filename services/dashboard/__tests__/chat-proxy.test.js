'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { once } = require('node:events');
const { WebSocket } = require('ws');
const { createServer } = require('../server');
const { createAgentChatServer } = require('../../agent-chat/server');
const { readToken } = require('../../agent-chat/session-auth');

function get(port, endpoint = '/', headers = {}) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: endpoint, headers }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}

async function fixture(t, credentialMissing = false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-chat-proxy-'));
  const tokenFile = path.join(dir, 'agent.token');
  const upstream = createAgentChatServer({ agentPort: 0, dashboardPort: 0, tokenFile,
    autoSavePath: path.join(dir, 'chat.md'), logger: () => {} });
  await upstream.start();
  const server = createServer({ metricsRoot: dir, projectRoot: dir,
    chatPort: upstream.dashServer.address().port,
    chatTokenFile: credentialMissing ? path.join(dir, 'missing.token') : tokenFile,
    onError: err => { throw err; } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const sockets = [];
  t.after(async () => {
    sockets.forEach(ws => ws.terminate());
    await new Promise(resolve => server.close(resolve));
    await upstream.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const port = server.address().port;
  const index = await get(port);
  assert.equal(index.status, 200);
  const cookie = index.headers['set-cookie'][0].split(';')[0];
  const headers = { cookie, origin: `http://127.0.0.1:${port}` };
  return { server, upstream, tokenFile, port, index, cookie, headers,
    connect(supplied = headers, endpoint = '/api/chat') {
      const ws = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`, { headers: supplied });
      sockets.push(ws);
      return ws;
    } };
}

async function rejected(ws, status) {
  ws.on('error', () => {});
  const [, res] = await once(ws, 'unexpected-response');
  assert.equal(res.statusCode, status);
  ws.terminate();
}

test('dashboard proxy preserves authenticated history/live updates and never forwards browser commands', { timeout: 10_000 }, async t => {
  const f = await fixture(t);
  const token = readToken(f.tokenFile);
  assert.match(f.index.headers['set-cookie'][0], /HttpOnly; SameSite=Strict/);
  assert.equal(f.index.headers['cache-control'], 'no-store');
  assert.ok(!f.index.body.includes(token));
  assert.match(f.index.body, /location\.host\}\/api\/chat/);
  const browser = f.connect();
  const [init] = await once(browser, 'message');
  assert.deepEqual(JSON.parse(init).history, []);
  const agent = new WebSocket(`ws://127.0.0.1:${f.upstream.agentServer.address().port}/`, {
    headers: { 'x-forgeflow-token': token },
  });
  t.after(() => agent.terminate());
  await once(agent, 'open');
  agent.send('fc');
  await once(agent, 'message');
  agent.send(JSON.stringify({ agent: 'fc', level: 'decision', message: 'proxy delivery' }));
  const [message] = await once(browser, 'message');
  assert.equal(JSON.parse(message).message, 'proxy delivery');
  assert.ok(!message.toString().includes(token));
  browser.send('/clear');
  const exported = await get(f.upstream.dashServer.address().port, '/export', { 'x-forgeflow-token': token });
  assert.match(exported.body, /proxy delivery/);
  const second = f.connect();
  assert.equal(JSON.parse((await once(second, 'message'))[0]).history[0].message, 'proxy delivery');
});

test('dashboard proxy rejects missing session, foreign origins, rebinding hosts and cross-site bootstrap', { timeout: 10_000 }, async t => {
  const f = await fixture(t);
  for (const headers of [{}, { cookie: f.cookie }, { origin: f.headers.origin },
    { ...f.headers, origin: 'https://attacker.invalid' },
    { ...f.headers, host: `attacker.invalid:${f.port}` },
    { ...f.headers, 'sec-fetch-site': 'cross-site' }]) {
    await rejected(f.connect(headers), 403);
  }
  await rejected(f.connect(f.headers, '/api/chat?token=unused'), 403);
  for (const headers of [{ origin: 'https://attacker.invalid' },
    { host: `attacker.invalid:${f.port}` }, { 'sec-fetch-site': 'cross-site' }]) {
    const result = await get(f.port, '/', headers);
    assert.equal(result.status, 400);
    assert.equal(result.headers['set-cookie'], undefined);
  }
  assert.equal((await get(f.port, '/', { 'sec-fetch-mode': 'no-cors' })).status, 403);
});

test('dashboard proxy reports unavailable chat without exposing credential details', { timeout: 10_000 }, async t => {
  const f = await fixture(t, true);
  await rejected(f.connect(), 503);
});
