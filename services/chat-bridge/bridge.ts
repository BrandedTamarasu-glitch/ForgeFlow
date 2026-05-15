// chat-bridge/bridge.ts — HTTP control plane for the agent chat bridge.
// Listens on 127.0.0.1:4002 and exposes five endpoints:
//   POST /room        — switch active room
//   POST /send        — route a chat message through the connection pool
//   POST /lifecycle   — broadcast a lifecycle event to all agents
//   POST /verbosity   — change the verbosity threshold
//   GET  /status      — health and connection state

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  VALID_AGENTS,
  VALID_LEVELS,
  parseSendRequest,
  parseRoomRequest,
  parseLifecycleRequest,
  parseVerbosityRequest,
} from './types.js';
import type {
  VerbosityLevel,
  AgentId,
  ChatMessage,
  SendResponse,
  RoomResponse,
  LifecycleResponse,
  StatusResponse,
  VerbosityResponse,
  BridgeConfig,
} from './types.js';
import { shouldPass } from './verbosity.js';
import { createConnectionPool } from './connections.js';
import type { ConnectionPool } from './connections.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BRIDGE_HOST = '127.0.0.1';
const BRIDGE_PORT = 4002;
const UPSTREAM_WS_URL = 'ws://127.0.0.1:4000';
const LOG_PREFIX = '[bridge]';
const DEFAULT_VERBOSITY: VerbosityLevel = 'decision';
const DEFAULT_ROOM = 'default';

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(msg: string): void {
  process.stderr.write(`${LOG_PREFIX} ${msg}\n`);
}

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------

const MAX_BODY_BYTES = 65_536; // 64 KB

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        req.destroy();
        reject(new RangeError('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new SyntaxError('Invalid JSON'));
      }
    });

    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function badRequest(res: ServerResponse, error: string): void {
  writeJson(res, 400, { ok: false, error });
}

function notFound(res: ServerResponse): void {
  writeJson(res, 404, { ok: false, error: 'Not found' });
}

function methodNotAllowed(res: ServerResponse): void {
  writeJson(res, 405, { ok: false, error: 'Method not allowed' });
}

// ---------------------------------------------------------------------------
// Lifecycle broadcast
// Uses the system-level "fc" agent slot as sender for system events,
// but broadcasts to ALL agents so every channel receives the event.
// ---------------------------------------------------------------------------

function broadcastLifecycle(
  pool: ConnectionPool,
  room: string,
  event: string,
  data?: string,
): void {
  const message = data ? `[lifecycle] ${event} — ${data}` : `[lifecycle] ${event}`;

  pool.send({ agent: 'fc', level: 'phase', message, timestamp: Date.now(), room });
}

// ---------------------------------------------------------------------------
// BridgeServer — wires config, pool, and mutable runtime state
// ---------------------------------------------------------------------------

interface BridgeState {
  verbosity: VerbosityLevel;
  currentRoom: string;
}

function createBridgeConfig(): BridgeConfig {
  const hash = crypto
    .createHash('sha256')
    .update(process.cwd())
    .digest('hex')
    .slice(0, 8);

  return {
    agentChatHost: '127.0.0.1',
    agentChatHttpPort: 4000,
    bridgeHost: BRIDGE_HOST,
    bridgePort: BRIDGE_PORT,
    pidFile: `/tmp/chat-bridge-${hash}.pid`,
    readyFile: `/tmp/chat-bridge-${hash}.ready`,
    maxQueuePerAgent: 100,
    maxMessageLength: 2000,
  };
}

// ---------------------------------------------------------------------------
// Request router
// ---------------------------------------------------------------------------

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pool: ConnectionPool,
  state: BridgeState,
): Promise<void> {
  const { method, url } = req;

  // ------------------------------------------------------------------
  // GET /status
  // ------------------------------------------------------------------
  if (url === '/status' && method === 'GET') {
    const body: StatusResponse = {
      ok: true,
      connections: pool.getStatus(),
      currentRoom: state.currentRoom,
      verbosity: state.verbosity,
      uptime: process.uptime(),
      queuedMessages: pool.getQueuedCount(),
    };
    writeJson(res, 200, body);
    return;
  }

  // All remaining endpoints are POST only
  if (method !== 'POST') {
    if (url === '/status') {
      methodNotAllowed(res);
    } else {
      notFound(res);
    }
    return;
  }

  let rawBody: unknown;
  try {
    rawBody = await readBody(req);
  } catch {
    badRequest(res, 'Invalid JSON');
    return;
  }

  // ------------------------------------------------------------------
  // POST /room
  // ------------------------------------------------------------------
  if (url === '/room') {
    const parsed = parseRoomRequest(rawBody);
    if (parsed === null) {
      badRequest(res, 'Invalid room name — must match [a-z0-9-]{1,100}');
      return;
    }

    pool.joinRoom(parsed.name);
    state.currentRoom = parsed.name;
    log(`room changed to ${parsed.name}`);

    const body: RoomResponse = { ok: true, room: parsed.name };
    writeJson(res, 200, body);
    return;
  }

  // ------------------------------------------------------------------
  // POST /send
  // ------------------------------------------------------------------
  if (url === '/send') {
    // Truncate message before validation so oversized payloads are
    // accepted with a silent trim rather than rejected outright.
    if (
      rawBody !== null &&
      typeof rawBody === 'object' &&
      !Array.isArray(rawBody) &&
      'message' in rawBody &&
      typeof (rawBody as Record<string, unknown>)['message'] === 'string'
    ) {
      const asRecord = rawBody as Record<string, unknown>;
      const msg = asRecord['message'] as string;
      if (msg.length > 2000) {
        asRecord['message'] = msg.slice(0, 2000);
      }
    }

    const parsed = parseSendRequest(rawBody);
    if (parsed === null) {
      badRequest(res, 'Invalid request — agent, level, and non-empty message required');
      return;
    }

    const level = parsed.level;

    if (!shouldPass(level, state.verbosity)) {
      const body: SendResponse = { ok: true, filtered: true };
      writeJson(res, 200, body);
      return;
    }

    const chatMsg: ChatMessage = {
      agent: parsed.agent,
      level,
      message: parsed.message,
      timestamp: Date.now(),
      room: state.currentRoom,
    };

    try {
      pool.send(chatMsg);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log(`send error for ${chatMsg.agent}: ${message}`);
    }

    const body: SendResponse = { ok: true };
    writeJson(res, 200, body);
    return;
  }

  // ------------------------------------------------------------------
  // POST /lifecycle
  // ------------------------------------------------------------------
  if (url === '/lifecycle') {
    const parsed = parseLifecycleRequest(rawBody);
    if (parsed === null) {
      badRequest(res, 'Invalid request — event must be a non-empty string');
      return;
    }

    if (parsed.event.length > 500) {
      badRequest(res, 'event must be 500 characters or fewer');
      return;
    }
    if (parsed.data !== undefined && parsed.data.length > 2000) {
      badRequest(res, 'data must be 2000 characters or fewer');
      return;
    }

    try {
      broadcastLifecycle(pool, state.currentRoom, parsed.event, parsed.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log(`lifecycle broadcast error: ${message}`);
    }

    const body: LifecycleResponse = { ok: true };
    writeJson(res, 200, body);
    return;
  }

  // ------------------------------------------------------------------
  // POST /verbosity
  // ------------------------------------------------------------------
  if (url === '/verbosity') {
    const parsed = parseVerbosityRequest(rawBody);
    if (parsed === null) {
      badRequest(
        res,
        `Invalid level — must be one of: ${VALID_LEVELS.join(', ')}`,
      );
      return;
    }

    const previous = state.verbosity;
    state.verbosity = parsed.level;
    log(`verbosity changed from ${previous} to ${state.verbosity}`);

    const body: VerbosityResponse = { ok: true, level: state.verbosity, previous };
    writeJson(res, 200, body);
    return;
  }

  notFound(res);
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const config = createBridgeConfig();

  const pool = createConnectionPool(config);

  const state: BridgeState = {
    verbosity: DEFAULT_VERBOSITY,
    currentRoom: DEFAULT_ROOM,
  };

  // Connect the pool to the upstream WebSocket server
  await pool.connect(UPSTREAM_WS_URL);
  log('connection pool initialised');

  // Profile registration disabled — agent-chat server does not yet expose
  // a /api/profile endpoint. Re-enable when the endpoint is implemented.

  // Create the HTTP server
  const server = http.createServer(
    (req: IncomingMessage, res: ServerResponse) => {
      handleRequest(req, res, pool, state).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        log(`unhandled request error: ${message}`);
        if (!res.headersSent) {
          writeJson(res, 500, { ok: false, error: 'Internal server error' });
        }
      });
    },
  );

  server.listen(BRIDGE_PORT, BRIDGE_HOST, () => {
    log(`listening on ${BRIDGE_HOST}:${BRIDGE_PORT}`);

    // Write ready file so shell scripts can poll for startup
    try {
      fs.writeFileSync(config.readyFile, `${process.pid}\n`, 'utf8');
      log(`ready file written: ${config.readyFile}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log(`failed to write ready file: ${message}`);
    }
  });

  // -------------------------------------------------------------------------
  // Clean shutdown
  // -------------------------------------------------------------------------

  function shutdown(signal: string): void {
    log(`received ${signal} — shutting down`);

    server.close(() => {
      log('HTTP server closed');
    });

    pool.shutdown().then(() => {
      log('connection pool closed');

      // Remove ready file on clean exit
      try {
        fs.unlinkSync(config.readyFile);
      } catch {
        // Best-effort — ignore if already gone
      }

      process.exit(0);
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      log(`pool shutdown error: ${message}`);
      process.exit(1);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${LOG_PREFIX} fatal: ${message}\n`);
  process.exit(1);
});
