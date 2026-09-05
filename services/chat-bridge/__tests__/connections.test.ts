// __tests__/connections.test.ts
// Unit tests for the connection pool.
//
// Uses a closed port (29999) so WebSockets stay in CONNECTING state —
// this is enough to test queue behaviour without a real server or mocking.
// Each pool is shut down at end of test to clear reconnect timers.
//
// Run with:
//   npx tsx --test services/chat-bridge/__tests__/connections.test.ts

import { test, after } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import agentChat from '../../agent-chat/server.js';
import assert from 'node:assert/strict';
import type { BridgeConfig, ChatMessage, AgentId } from '../types.ts';
import { createConnectionPool } from '../connections.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Non-listening port — WS stays in CONNECTING (readyState=0), never OPEN. */
const DEAD_URL = 'ws://127.0.0.1:29999';
const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-auth-test-'));
const fixtureToken = path.join(fixtureDir, 'session.token');
fs.writeFileSync(fixtureToken, 'a'.repeat(64), { mode: 0o600 });
after(() => fs.rmSync(fixtureDir, { recursive: true, force: true }));

function makeConfig(overrides: Partial<BridgeConfig> = {}): BridgeConfig {
  return {
    agentChatTokenFile: fixtureToken,
    agentChatHost: '127.0.0.1',
    agentChatHttpPort: 4001,
    bridgeHost: '127.0.0.1',
    bridgePort: 4002,
    pidFile: '/tmp/test-bridge.pid',
    readyFile: '/tmp/test-bridge.ready',
    tokenFile: '/tmp/test-bridge.token',
    maxQueuePerAgent: 5,
    maxMessageLength: 2000,
    ...overrides,
  };
}

function makeMessage(agent: AgentId, suffix = ''): ChatMessage {
  return {
    agent,
    level: 'decision',
    message: `test message${suffix}`,
    timestamp: Date.now(),
    room: 'test-room',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('initial status: all agents disconnected after connect() before events fire', async () => {
  const pool = createConnectionPool(makeConfig());

  // connect() populates the agents map synchronously; events fire later async
  await pool.connect(DEAD_URL);

  // Check immediately — ECONNREFUSED fires on next tick, status still 'disconnected'
  const status = pool.getStatus();
  const agents: AgentId[] = ['compass', 'fc', 'warden', 'lumen', 'atlas', 'arbiter'];
  for (const id of agents) {
    assert.equal(status[id], 'disconnected', `${id} should start disconnected`);
  }

  await pool.shutdown();
});

test('send() to disconnected pool queues messages', async () => {
  const pool = createConnectionPool(makeConfig({ maxQueuePerAgent: 10 }));

  // Connect to dead URL — sockets start in CONNECTING (readyState=0), not OPEN
  await pool.connect(DEAD_URL);

  const result = pool.send(makeMessage('fc'));
  assert.equal(result, false, 'send returns false when not OPEN');
  assert.equal(pool.getQueuedCount(), 1, 'one message queued');

  await pool.shutdown();
});

test('queue overflow: oldest message dropped when maxQueuePerAgent exceeded', async () => {
  const maxQ = 3;
  const pool = createConnectionPool(makeConfig({ maxQueuePerAgent: maxQ }));

  await pool.connect(DEAD_URL);

  // Fill beyond capacity
  for (let i = 0; i < maxQ + 2; i++) {
    pool.send(makeMessage('fc', ` ${i}`));
  }

  assert.equal(pool.getQueuedCount(), maxQ, `queue capped at ${maxQ}`);

  await pool.shutdown();
});

test('shutdown() clears all queues', async () => {
  const pool = createConnectionPool(makeConfig({ maxQueuePerAgent: 20 }));

  await pool.connect(DEAD_URL);

  pool.send(makeMessage('fc'));
  pool.send(makeMessage('warden'));
  pool.send(makeMessage('compass'));

  assert.ok(pool.getQueuedCount() > 0, 'queue non-empty before shutdown');
  await pool.shutdown();
  assert.equal(pool.getQueuedCount(), 0, 'queue cleared after shutdown');
});

test('getQueuedCount() sums across all agents', async () => {
  const pool = createConnectionPool(makeConfig({ maxQueuePerAgent: 10 }));

  await pool.connect(DEAD_URL);

  pool.send(makeMessage('fc'));
  pool.send(makeMessage('warden'));
  pool.send(makeMessage('compass'));

  assert.equal(pool.getQueuedCount(), 3, 'counts messages across different agents');

  await pool.shutdown();
});

test('send() to unknown agent returns false without queuing', async () => {
  const pool = createConnectionPool(makeConfig());

  await pool.connect(DEAD_URL);

  // Cast to bypass TS to exercise runtime guard
  const result = pool.send({
    agent: 'ghost' as AgentId,
    level: 'phase',
    message: 'hi',
    timestamp: Date.now(),
    room: 'r',
  });
  assert.equal(result, false);
  assert.equal(pool.getQueuedCount(), 0);

  await pool.shutdown();
});


test('legitimate bridge authenticates all agents and delivers queued messages to protected history', { timeout: 10_000 }, async t => {
  const tokenFile = path.join(fixtureDir, 'upstream.token');
  const upstream = agentChat.createAgentChatServer({ agentPort: 0, dashboardPort: 0,
    tokenFile, autoSavePath: path.join(fixtureDir, 'log.md'), logger: () => {} });
  await upstream.start();
  const pool = createConnectionPool(makeConfig({ agentChatTokenFile: tokenFile }));
  t.after(async () => { await pool.shutdown(); await upstream.stop(); });
  await pool.connect(`ws://127.0.0.1:${upstream.agentServer.address().port}/`);
  pool.joinRoom('bridge-test');
  assert.equal(pool.send(makeMessage('fc', ' integration')), false);
  const deadline = Date.now() + 5_000;
  while (!Object.values(pool.getStatus()).every(status => status === 'connected')) {
    assert.ok(Date.now() < deadline, 'all bridge identities authenticate within deadline');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.equal(pool.getQueuedCount(), 0);
  const body = await new Promise<string>((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: upstream.dashServer.address().port, path: '/export',
      headers: { 'x-forgeflow-token': fs.readFileSync(tokenFile, 'utf8').trim() } }, res => {
      let text = '';
      assert.equal(res.statusCode, 200);
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => resolve(text));
    }).on('error', reject);
  });
  assert.match(body, /test message integration/);
});

test('bridge with invalid credential never becomes connected or drains queued messages', { timeout: 10_000 }, async t => {
  const upstream = agentChat.createAgentChatServer({ agentPort: 0, dashboardPort: 0,
    tokenFile: path.join(fixtureDir, 'invalid-upstream.token'), logger: () => {} });
  await upstream.start();
  const pool = createConnectionPool(makeConfig());
  t.after(async () => { await pool.shutdown(); await upstream.stop(); });
  await pool.connect(`ws://127.0.0.1:${upstream.agentServer.address().port}/`);
  pool.send(makeMessage('compass'));
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(pool.getStatus().compass, 'reconnecting');
  assert.equal(pool.getQueuedCount(), 1);
});

test('bridge reconnect reads a rotated upstream credential before delivering queued messages', { timeout: 10_000 }, async t => {
  const tokenFile = path.join(fixtureDir, 'rotating.token');
  const upstream = agentChat.createAgentChatServer({ agentPort: 0, dashboardPort: 0, tokenFile, logger: () => {} });
  await upstream.start();
  const port = upstream.agentServer.address().port;
  const pool = createConnectionPool(makeConfig({ agentChatTokenFile: tokenFile }));
  t.after(async () => { await pool.shutdown(); await upstream.stop(); });
  await pool.connect(`ws://127.0.0.1:${port}/`);
  async function waitFor(predicate: () => boolean) {
    const deadline = Date.now() + 4_000;
    while (!predicate()) {
      assert.ok(Date.now() < deadline, 'connection state changed within deadline');
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }
  await waitFor(() => pool.getStatus().compass === 'connected');
  const before = fs.readFileSync(tokenFile, 'utf8');
  await upstream.stop();
  await waitFor(() => pool.getStatus().compass !== 'connected');
  assert.equal(pool.send(makeMessage('compass', ' after restart')), false);
  const replacement = agentChat.createAgentChatServer({ agentPort: port, dashboardPort: 0,
    tokenFile, autoSavePath: path.join(fixtureDir, 'rotation-log.md'), logger: () => {} });
  await replacement.start();
  t.after(() => replacement.stop());
  assert.notEqual(fs.readFileSync(tokenFile, 'utf8'), before);
  await waitFor(() => pool.getStatus().compass === 'connected');
  assert.equal(pool.getQueuedCount(), 0);
});
