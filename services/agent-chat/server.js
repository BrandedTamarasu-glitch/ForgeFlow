// agent-chat/server.js
//
// Two listeners, both bound exclusively to 127.0.0.1:
//
//   TCP port 4000  — agent-chat protocol (WebSocket)
//                    bridge agents authenticate with their agentId, then send
//                    JSON ChatMessage objects.
//
//   HTTP port 4001 — dashboard (HTTP GET /) + WebSocket fan-out to browsers.
//                    All incoming agent messages are broadcast here in real time.
//
// Security:
//   - Both servers bind '127.0.0.1', never '0.0.0.0'.
//   - Dashboard renders all content via textContent — no server-side HTML escaping applied.
//   - No external dependencies beyond the built-in 'ws' module.

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');
const os = require('os');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const AGENT_HOST = '127.0.0.1';
const AGENT_PORT = 4000;   // bridge → server (agent WebSocket protocol)
const DASH_HOST  = '127.0.0.1';
const DASH_PORT  = 4001;   // browser → server (dashboard HTTP + WS)

const VALID_AGENTS = new Set(['compass', 'fc', 'warden', 'lumen', 'atlas', 'arbiter']);
const VALID_LEVELS = new Set(['phase', 'decision', 'conversation']);

const RATE_LIMIT_MAX       = 60;      // messages per window
const RATE_LIMIT_WINDOW_MS = 10_000;  // 10 seconds

// Message history kept in memory — last 500 messages.
const MAX_HISTORY = 500;

// Auto-save: written every AUTO_SAVE_INTERVAL messages and on shutdown.
// Survives dirty exits (process killed, session closed without /agent-chat:off).
const AUTO_SAVE_PATH = path.join(os.tmpdir(), 'agent-chat-log.md');
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
  process.stderr.write(`[agent-chat] ${msg}\n`);
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

const agentServer = http.createServer((_req, res) => {
  res.writeHead(404).end('Not Found');
});

const wssAgents = new WebSocketServer({ server: agentServer });

wssAgents.on('connection', (ws) => {
  agentClients.set(ws, { agentId: null, msgCount: 0, windowStart: Date.now() });
  log('Agent client connected (unauthenticated)');

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
    // Authentication: first message is the agentId
    // -----------------------------------------------------------------------
    if (state.agentId === null) {
      if (VALID_AGENTS.has(text)) {
        state.agentId = text;
        log(`Agent authenticated: ${text}`);
        ws.send(JSON.stringify({ type: 'ack' }));
      } else {
        log(`Auth rejected: unknown agentId "${text}"`);
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
      log(`Malformed JSON from ${state.agentId}: ${text.slice(0, 80)}`);
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

agentServer.listen(AGENT_PORT, AGENT_HOST, () => {
  log(`Agent WS server listening on ws://${AGENT_HOST}:${AGENT_PORT}`);
});

// ---------------------------------------------------------------------------
// Port 4001 — Dashboard HTTP server + WebSocket fan-out (browser → here)
// ---------------------------------------------------------------------------

const dashServer = http.createServer((req, res) => {
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
        'Cache-Control': 'no-cache',
      }).end(data);
    });
    return;
  }

  res.writeHead(404).end('Not Found');
});

const wssDash = new WebSocketServer({ server: dashServer });

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

dashServer.listen(DASH_PORT, DASH_HOST, () => {
  log(`Dashboard HTTP server listening on http://${DASH_HOST}:${DASH_PORT}`);
  log(`Dashboard WS  server listening on ws://${DASH_HOST}:${DASH_PORT}`);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function shutdown(signal) {
  log(`Received ${signal}, shutting down`);

  // Final auto-save before closing connections
  if (messageHistory.length > 0) {
    autoSave();
    log(`auto-saved ${messageHistory.length} messages to ${AUTO_SAVE_PATH}`);
  }

  for (const ws of agentClients.keys()) ws.close();
  for (const ws of dashboardClients) ws.close();

  agentServer.close(() => {
    dashServer.close(() => {
      log('Clean exit');
      process.exit(0);
    });
  });

  // Force-exit after 5 s if something hangs
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
