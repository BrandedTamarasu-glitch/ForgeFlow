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

function request(port, endpoint = '/', headers = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: endpoint, method, headers }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function rejectedSocket(url, headers) {
  const ws = new WebSocket(url, { headers });
  ws.on('error', () => {});
  const [, res] = await once(ws, 'unexpected-response');
  assert.equal(res.statusCode, 403);
  // Close the rejected pending handshake explicitly.
  ws.terminate();
  return res;
}

async function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-chat-auth-test-'));
  const logs = [];
  const tokenFile = path.join(dir, 'session.token');
  const server = createAgentChatServer({ agentPort: 0, dashboardPort: 0, tokenFile,
    autoSavePath: path.join(dir, 'log.md'), logger: line => logs.push(line) });
  await server.start();
  t.after(async () => { await server.stop(); fs.rmSync(dir, { recursive: true, force: true }); });
  return { ...server, logs, tokenFile, token: readToken(tokenFile),
    agentPort: server.agentServer.address().port, port: server.dashServer.address().port };
}

test('local UI bootstraps private cookie; reads, writes and foreign origins are protected', { timeout: 10_000 }, async t => {
  const f = await fixture(t);
  const origin = `http://127.0.0.1:${f.port}`;
  const index = await request(f.port);
  assert.equal(index.status, 200);
  assert.equal(index.headers['cache-control'], 'no-store');
  const setCookie = index.headers['set-cookie'][0];
  assert.match(setCookie, /HttpOnly; SameSite=Strict/);
  const cookie = setCookie.split(';')[0];
  assert.ok(!index.body.includes(f.token));
  assert.equal(fs.statSync(f.tokenFile).mode & 0o777, 0o600);
  for (const endpoint of ['/', '/export', '/auto-save-path']) {
    assert.equal((await request(f.port, endpoint, { host: `attacker.invalid:${f.port}` })).status, 403);
    assert.equal((await request(f.port, endpoint, { origin: 'https://attacker.invalid', cookie })).status, 403);
    assert.equal((await request(f.port, endpoint, { 'sec-fetch-site': 'cross-site', cookie })).status, 403);
  }
  assert.equal((await request(f.port, '/', { origin: 'null' })).status, 403);
  assert.equal((await request(f.port, '/', { 'sec-fetch-mode': 'no-cors' })).status, 403);
  for (const endpoint of ['/export', '/auto-save-path']) {
    assert.equal((await request(f.port, endpoint)).status, 401);
    assert.equal((await request(f.port, endpoint, { cookie })).status, 200);
    assert.equal((await request(f.port, endpoint, { 'x-forgeflow-token': f.token })).status, 200);
  }
  assert.equal((await request(f.port, '/clear', {}, 'POST')).status, 401);
  assert.equal((await request(f.port, '/clear', { 'x-forgeflow-token': 'wrong' }, 'POST')).status, 401);
  assert.equal((await request(f.port, '/clear', { 'x-forgeflow-token': f.token, origin: 'https://attacker.invalid' }, 'POST')).status, 403);
  assert.equal((await request(f.port, '/clear', { cookie }, 'POST')).status, 403);
  assert.equal((await request(f.port, '/clear', { cookie, origin: 'https://attacker.invalid' }, 'POST')).status, 403);
  assert.equal((await request(f.port, '/clear', { cookie, origin }, 'POST')).status, 204);
  assert.equal((await request(f.port, '/clear', { 'x-forgeflow-token': f.token }, 'POST')).status, 204);
  assert.ok(f.logs.every(line => !line.includes(f.token) && !line.includes(cookie.split('=')[1])));
});

test('WebSockets require valid credentials and reject foreign Host/Origin before history or writes', { timeout: 10_000 }, async t => {
  const f = await fixture(t);
  const agentUrl = `ws://127.0.0.1:${f.agentPort}/`;
  const dashUrl = `ws://127.0.0.1:${f.port}/`;
  for (const headers of [{}, { 'x-forgeflow-token': 'wrong' },
    { 'x-forgeflow-token': f.token, origin: 'https://attacker.invalid' },
    { 'x-forgeflow-token': f.token, host: `attacker.invalid:${f.agentPort}` }]) {
    await rejectedSocket(agentUrl, headers);
  }
  const proxy = new WebSocket(dashUrl, { headers: { 'x-forgeflow-token': f.token } });
  t.after(() => proxy.terminate());
  assert.equal(JSON.parse((await once(proxy, 'message'))[0]).type, 'init');
  await rejectedSocket(dashUrl, { 'x-forgeflow-token': f.token, origin: 'https://attacker.invalid' });
  const agent = new WebSocket(agentUrl, { headers: { 'x-forgeflow-token': f.token } });
  t.after(() => agent.terminate());
  await once(agent, 'open');
  agent.send('fc');
  const [ack] = await once(agent, 'message');
  assert.equal(JSON.parse(ack).type, 'ack');
  const index = await request(f.port);
  const cookie = index.headers['set-cookie'][0].split(';')[0];
  for (const headers of [{}, { cookie }, { cookie, origin: 'https://attacker.invalid' }]) {
    await rejectedSocket(dashUrl, headers);
  }
  const dash = new WebSocket(dashUrl, { headers: { cookie, origin: `http://127.0.0.1:${f.port}` } });
  t.after(() => dash.terminate());
  const [init] = await once(dash, 'message');
  assert.deepEqual(JSON.parse(init).history, []);
  agent.send(JSON.stringify({ agent: 'fc', level: 'phase', message: 'authorized' }));
  const [message] = await once(dash, 'message');
  assert.equal(JSON.parse(message).message, 'authorized');
  assert.match((await request(f.port, '/export', { cookie })).body, /authorized/);
  await request(f.port, '/clear', {}, 'POST');
  assert.match((await request(f.port, '/export', { cookie })).body, /authorized/);
  const cleared = once(dash, 'message');
  await request(f.port, '/clear', { cookie, origin: `http://127.0.0.1:${f.port}` }, 'POST');
  assert.equal(JSON.parse((await cleared)[0]).event, 'history-cleared');
  assert.doesNotMatch((await request(f.port, '/export', { cookie })).body, /authorized/);
});

test('credential rotates per session and safe reader rejects exposed files and symlinks', { timeout: 10_000 }, async t => {
  const f = await fixture(t);
  const previous = f.token;
  await f.stop();
  assert.equal(fs.existsSync(f.tokenFile), false);
  const next = createAgentChatServer({ agentPort: 0, dashboardPort: 0, tokenFile: f.tokenFile, logger: () => {} });
  await next.start();
  t.after(() => next.stop());
  assert.notEqual(readToken(f.tokenFile), previous);
  await rejectedSocket(`ws://127.0.0.1:${next.agentServer.address().port}/`, { 'x-forgeflow-token': previous });
  fs.chmodSync(f.tokenFile, 0o644);
  assert.throws(() => readToken(f.tokenFile), /Unsafe/);
  fs.chmodSync(f.tokenFile, 0o600);
  fs.symlinkSync(f.tokenFile, `${f.tokenFile}.link`);
  assert.throws(() => readToken(`${f.tokenFile}.link`));
});
