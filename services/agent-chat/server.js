// agent-chat/server.js
//
// Two listeners, both bound exclusively to 127.0.0.1:
//
//   TCP port 4000  — agent-chat protocol (WebSocket)
//                    bridge agents authenticate a session token, select agentId, then send
//                    JSON ChatMessage objects.
//
//   HTTP port 4001 — dashboard (HTTP GET /) + WebSocket fan-out to browsers.
//                    All incoming agent messages are broadcast here in real time.
//
// Security:
//   - Both servers bind '127.0.0.1', never '0.0.0.0'.
//   - Dashboard renders all content via textContent — no server-side HTML escaping applied.
//   - Session credentials and strict Host/Origin checks protect both listeners.
//   - The only external dependency is the 'ws' package.

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');
const os = require('os');
const crypto = require('crypto');
const { defaultTokenFile, readToken } = require('./session-auth');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function createAgentChatServer(options = {}) {
const AGENT_HOST = '127.0.0.1';
const AGENT_PORT = options.agentPort ?? 4000;   // bridge → server (agent WebSocket protocol)
const DASH_HOST  = '127.0.0.1';
const DASH_PORT  = options.dashboardPort ?? 4001;   // browser → server (dashboard HTTP + WS)

const VALID_AGENTS = new Set(['compass', 'fc', 'warden', 'lumen', 'atlas', 'arbiter']);
const VALID_LEVELS = new Set(['phase', 'decision', 'conversation']);

const RATE_LIMIT_MAX       = 60;      // messages per window
const RATE_LIMIT_WINDOW_MS = 10_000;  // 10 seconds

// Message history kept in memory — last 500 messages.
const MAX_HISTORY = 500;

// Auto-save: written every AUTO_SAVE_INTERVAL messages and on shutdown.
// Survives dirty exits (process killed, session closed without /agent-chat:off).
const AUTO_SAVE_PATH = options.autoSavePath ?? path.join(os.tmpdir(), 'agent-chat-log.md');
const tokenFile = options.tokenFile ?? defaultTokenFile();
const agentToken = crypto.randomBytes(32).toString('hex');
const dashboardToken = crypto.randomBytes(32).toString('hex');
const AUTO_SAVE_INTERVAL = 10; // messages between flushes

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** @type {Array<{agent: string, level: string, message: string, timestamp: number, room: string}>} */
const messageHistory = [];

/** @type {Map<WebSocket, {agentId: string|null, msgCount: number, windowStart: number}>} */
const agentClients = new Map();

/** @type {Set<WebSocket>} */
const dashboardClients = new Set();

let currentRoom = '';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  if (options.logger) options.logger(msg);
  else process.stderr.write(`[agent-chat] ${msg}\n`);
}

// Pin Host to the actual listener and reject browser requests from other origins.
function isLocalRequest(req) {
  const host = req.headers.host;
  const port = req.socket.localPort;
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return false;
  if (req.headers.origin !== undefined && req.headers.origin !== `http://${host}`) return false;
  const site = req.headers['sec-fetch-site'];
  return site === undefined || site === 'none' || site === 'same-origin';
}

function matches(supplied, expected) {
  if (typeof supplied !== 'string') return false;
  const actual = Buffer.from(supplied);
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && crypto.timingSafeEqual(actual, wanted);
}

function agentAuthorized(req) {
  return matches(req.headers['x-forgeflow-token'], agentToken);
}

function dashboardAuthorized(req) {
  const cookies = (req.headers.cookie ?? '').split(';').map(part => part.trim());
  return cookies.some(cookie => cookie.startsWith('forgeflow_chat=') &&
    matches(cookie.slice('forgeflow_chat='.length), dashboardToken));
}

function upgrade(server, wss, authorize) {
  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/' || !isLocalRequest(req) || !authorize(req)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });
}

/** Broadcast a message payload to all connected dashboard WebSocket clients. */
function broadcastToDashboard(payload) {
  const data = JSON.stringify(payload);
  for (const ws of dashboardClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

/** Build the markdown export string from current messageHistory. */
function buildMarkdown() {
  const lines = [
    '# Agent Chat Log',
    '',
    `**Room:** ${currentRoom || '(none)'}`,
    `**Exported:** ${new Date().toISOString()}`,
    `**Messages:** ${messageHistory.length}`,
    '',
  ];
  for (const msg of messageHistory) {
    const time = new Date(msg.timestamp).toISOString().slice(11, 19);
    lines.push('---', '', `**${time}** · ${msg.agent} · ${msg.level}`, '', msg.message, '');
  }
  return lines.join('\n');
}

/** Write the current log to AUTO_SAVE_PATH. Fire-and-forget — never throws. */
function autoSave() {
  try {
    fs.writeFileSync(AUTO_SAVE_PATH, buildMarkdown(), 'utf8');
  } catch (err) {
    log(`auto-save failed: ${err.message}`);
  }
}

/** Store a message in history (capped at MAX_HISTORY) and broadcast it. */
function recordAndBroadcast(msg) {
  // Dashboard always renders via textContent — no server-side HTML escaping needed.
  const safe = {
    agent:     String(msg.agent),
    level:     String(msg.level),
    message:   String(msg.message),
    timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : Date.now(),
    room:      String(msg.room ?? currentRoom),
  };

  messageHistory.push(safe);
  if (messageHistory.length > MAX_HISTORY) {
    messageHistory.shift();
  }

  broadcastToDashboard({ type: 'message', ...safe });

  // Auto-save every AUTO_SAVE_INTERVAL messages
  if (messageHistory.length % AUTO_SAVE_INTERVAL === 0) {
    autoSave();
  }
}

/** Broadcast a lifecycle event to dashboard clients. */
function broadcastLifecycle(event, extra) {
  // Dashboard always renders via textContent — pass values as-is.
  broadcastToDashboard({
    type:      'lifecycle',
    event:     String(event),
    timestamp: Date.now(),
    ...extra,
  });
}

// ---------------------------------------------------------------------------
// Port 4000 — Agent WebSocket server (bridge → here)
// ---------------------------------------------------------------------------

const agentServer = http.createServer((req, res) => {
  if (!isLocalRequest(req)) { res.writeHead(403).end('Forbidden'); return; }
  res.writeHead(404).end('Not Found');
});

const wssAgents = new WebSocketServer({ noServer: true, maxPayload: 16_384 });
upgrade(agentServer, wssAgents, agentAuthorized);

wssAgents.on('connection', (ws) => {
  agentClients.set(ws, { agentId: null, msgCount: 0, windowStart: Date.now() });
  log('Authenticated agent transport connected');

  ws.on('message', (raw) => {
    const text = raw.toString('utf8').trim();
    const state = agentClients.get(ws);
    if (!state) return;

    // Rate limiting
    const now = Date.now();
    if (now - state.windowStart >= RATE_LIMIT_WINDOW_MS) {
      state.msgCount = 0;
      state.windowStart = now;
    }
    state.msgCount++;
    if (state.msgCount > RATE_LIMIT_MAX) {
      log(`Rate limit exceeded for ${state.agentId ?? 'unauthenticated'}`);
      return;
    }

    // -----------------------------------------------------------------------
    // Identity selection after authenticated upgrade: first message is the agentId
    // -----------------------------------------------------------------------
    if (state.agentId === null) {
      if (VALID_AGENTS.has(text)) {
        state.agentId = text;
        log(`Agent authenticated: ${text}`);
        ws.send(JSON.stringify({ type: 'ack' }));
      } else {
        log('Unknown agent identity rejected');
        ws.close(1008, 'Unknown agent');
      }
      return;
    }

    // -----------------------------------------------------------------------
    // Commands
    // -----------------------------------------------------------------------
    if (text.startsWith('/join ')) {
      const room = text.slice(6).trim();
      if (!/^[a-z0-9-]{1,100}$/.test(room)) return;
      currentRoom = room;
      log(`Room changed to: ${room}`);
      broadcastLifecycle('room-changed', { room });
      return;
    }

    if (text === '/clear') {
      messageHistory.length = 0;
      log('Message history cleared');
      broadcastLifecycle('history-cleared', { room: currentRoom });
      return;
    }

    // -----------------------------------------------------------------------
    // JSON ChatMessage
    // -----------------------------------------------------------------------
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      log(`Malformed JSON from ${state.agentId}`);
      return;
    }

    // Validate shape
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !VALID_AGENTS.has(parsed.agent) ||
      parsed.agent !== state.agentId ||
      !VALID_LEVELS.has(parsed.level) ||
      typeof parsed.message !== 'string' ||
      parsed.message.length === 0 ||
      parsed.message.length > 2000
    ) {
      log(`Invalid ChatMessage shape from ${state.agentId}`);
      return;
    }

    recordAndBroadcast(parsed);
  });

  ws.on('close', () => {
    const state = agentClients.get(ws);
    if (state?.agentId) {
      log(`Agent disconnected: ${state.agentId}`);
    }
    agentClients.delete(ws);
  });

  ws.on('error', (err) => {
    log(`Agent WS error: ${err.message}`);
  });
});

// ---------------------------------------------------------------------------
// Port 4001 — Dashboard HTTP server + WebSocket fan-out (browser → here)
// ---------------------------------------------------------------------------

const dashServer = http.createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  if (!isLocalRequest(req)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  const isIndex = req.method === 'GET' && (req.url === '/' || req.url === '/index.html');
  // Only direct navigation or same-origin fetches may bootstrap a browser session.
  const mode = req.headers['sec-fetch-mode'];
  if (isIndex && mode !== undefined && mode !== 'navigate' && req.headers['sec-fetch-site'] !== 'same-origin') {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (!isIndex && !agentAuthorized(req) && !dashboardAuthorized(req)) {
    res.writeHead(401).end('Unauthorized');
    return;
  }
  if (req.method === 'POST' && !agentAuthorized(req) && req.headers.origin !== `http://${req.headers.host}`) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  if (req.method === 'POST' && req.url === '/clear') {
    messageHistory.length = 0;
    broadcastLifecycle('history-cleared', { room: currentRoom });
    log('Message history cleared via HTTP');
    res.writeHead(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.writeHead(405).end('Method Not Allowed');
    return;
  }

  if (req.url === '/export') {
    const markdown = buildMarkdown();
    res.writeHead(200, {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Length': Buffer.byteLength(markdown),
    }).end(markdown);
    return;
  }

  if (req.url === '/auto-save-path') {
    const body = JSON.stringify({ path: AUTO_SAVE_PATH, messages: messageHistory.length });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }).end(body);
    return;
  }

  if (req.url === '/' || req.url === '/index.html') {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    fs.readFile(indexPath, (err, data) => {
      if (err) {
        res.writeHead(500).end('Internal Server Error');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Set-Cookie': `forgeflow_chat=${dashboardToken}; HttpOnly; SameSite=Strict; Path=/`,
      }).end(data);
    });
    return;
  }

  res.writeHead(404).end('Not Found');
});

const wssDash = new WebSocketServer({ noServer: true, maxPayload: 16_384 });
upgrade(dashServer, wssDash, req => agentAuthorized(req) ||
  (dashboardAuthorized(req) && req.headers.origin === `http://${req.headers.host}`));

wssDash.on('connection', (ws) => {
  dashboardClients.add(ws);
  log('Dashboard client connected');

  // Send current state immediately on connect
  ws.send(JSON.stringify({
    type: 'init',
    room: currentRoom,
    history: messageHistory,
  }));

  ws.on('close', () => {
    dashboardClients.delete(ws);
    log('Dashboard client disconnected');
  });

  ws.on('error', (err) => {
    log(`Dashboard WS error: ${err.message}`);
    dashboardClients.delete(ws);
  });
});

async function start() {
  const listen = (server, port, host) => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  try {
    await listen(agentServer, AGENT_PORT, AGENT_HOST);
    await listen(dashServer, DASH_PORT, DASH_HOST);
    // Publish only after both binds succeed, without following an existing symlink.
    const temporary = `${tokenFile}.${process.pid}.${crypto.randomBytes(8).toString('hex')}`;
    try {
      fs.writeFileSync(temporary, `${agentToken}\n`, { flag: 'wx', mode: 0o600 });
      fs.renameSync(temporary, tokenFile);
    } finally {
      try { fs.unlinkSync(temporary); } catch (err) { if (err.code !== 'ENOENT') throw err; }
    }
    log(`Agent WS server listening on ws://${AGENT_HOST}:${agentServer.address().port}`);
    log(`Dashboard listening on http://${DASH_HOST}:${dashServer.address().port}`);
  } catch (err) {
    await stop();
    throw err;
  }
}

async function stop() {
  if (messageHistory.length > 0) autoSave();
  for (const ws of wssAgents.clients) ws.terminate();
  for (const ws of wssDash.clients) ws.terminate();
  await Promise.all([agentServer, dashServer].map(server => new Promise(resolve => server.close(resolve))));
  try {
    if (readToken(tokenFile) === agentToken) fs.unlinkSync(tokenFile);
  } catch (err) { if (err.code !== 'ENOENT') log('Could not remove session credential'); }
}

return { start, stop, agentServer, dashServer };
}

module.exports = { createAgentChatServer };

if (require.main === module) {
  const service = createAgentChatServer();
  service.start().catch(err => {
    process.stderr.write(`[agent-chat] startup failed: ${err.message}\n`);
    process.exitCode = 1;
  });
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, () => {
      const timer = setTimeout(() => process.exit(1), 5_000).unref();
      service.stop().then(() => clearTimeout(timer));
    });
  }
}
