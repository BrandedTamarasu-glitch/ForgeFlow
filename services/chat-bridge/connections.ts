// chat-bridge/connections.ts — WebSocket connection pool.
// Manages one persistent WebSocket per agent with exponential backoff reconnect
// and per-agent message queuing.

import WebSocket from 'ws';
import type { AgentId, ChatMessage, BridgeConfig, PooledConnection } from './types.js';
import { VALID_AGENTS } from './types.js';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface ConnectionPool {
  connect(agentChatWsUrl: string): Promise<void>;
  send(message: ChatMessage): boolean;
  joinRoom(room: string): void;
  getStatus(): Record<AgentId, PooledConnection['status']>;
  getQueuedCount(): number;
  shutdown(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Internal per-agent state
// ---------------------------------------------------------------------------

interface AgentState {
  conn: PooledConnection;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  wsUrl: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BACKOFF_BASE_MS = 1_000;
const BACKOFF_CAP_MS = 30_000;
const LOG_PREFIX = '[connections]';

function log(msg: string): void {
  process.stderr.write(`${LOG_PREFIX} ${msg}\n`);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createConnectionPool(config: BridgeConfig): ConnectionPool {
  const agents = new Map<AgentId, AgentState>();
  let currentRoom = '';
  let shutdownRequested = false;

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  function backoffMs(attempts: number): number {
    return Math.min(BACKOFF_BASE_MS * Math.pow(2, attempts), BACKOFF_CAP_MS);
  }

  function enqueue(state: AgentState, message: ChatMessage): void {
    const q = state.conn.messageQueue;
    if (q.length >= config.maxQueuePerAgent) {
      q.shift(); // FIFO eviction — drop oldest
    }
    q.push(message);
  }

  function drainQueue(state: AgentState): void {
    const { conn } = state;
    while (conn.messageQueue.length > 0 && conn.ws?.readyState === WebSocket.OPEN) {
      const msg = conn.messageQueue.shift()!;
      conn.ws.send(JSON.stringify(msg));
    }
  }

  function wsSend(ws: WebSocket, data: string): boolean {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
      return true;
    }
    return false;
  }

  // -----------------------------------------------------------------------
  // Connection lifecycle
  // -----------------------------------------------------------------------

  function scheduleReconnect(state: AgentState): void {
    if (shutdownRequested) return;

    const delay = backoffMs(state.conn.reconnectAttempts);
    state.conn.status = 'reconnecting';
    state.conn.reconnectAttempts += 1;

    log(`${state.conn.agentId} reconnecting in ${delay}ms (attempt ${state.conn.reconnectAttempts})`);

    state.reconnectTimer = setTimeout(() => {
      state.reconnectTimer = null;
      openSocket(state);
    }, delay);
  }

  function openSocket(state: AgentState): void {
    if (shutdownRequested) return;

    try {
      const ws = new WebSocket(state.wsUrl);

      ws.on('open', () => {
        state.conn.ws = ws;
        state.conn.status = 'connected';
        state.conn.reconnectAttempts = 0; // reset backoff on success

        // Authenticate: send agent name
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(state.conn.agentId);
        }

        // Join current room if one is set
        if (currentRoom && ws.readyState === WebSocket.OPEN) {
          ws.send(`/join ${currentRoom}`);
        }

        // Drain queued messages
        drainQueue(state);

        log(`${state.conn.agentId} connected`);
      });

      ws.on('close', () => {
        state.conn.ws = null;
        state.conn.status = 'disconnected';
        scheduleReconnect(state);
      });

      ws.on('error', (err: Error) => {
        log(`${state.conn.agentId} error: ${err.message}`);
        // 'close' event fires after 'error', so reconnect happens there
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log(`${state.conn.agentId} failed to create socket: ${message}`);
      scheduleReconnect(state);
    }
  }

  // -----------------------------------------------------------------------
  // Pool API
  // -----------------------------------------------------------------------

  const pool: ConnectionPool = {
    connect(agentChatWsUrl: string): Promise<void> {
      const STAGGER_MS = 200;
      let delay = 0;
      for (const agentId of VALID_AGENTS) {
        const state: AgentState = {
          conn: {
            agentId,
            ws: null,
            status: 'disconnected',
            reconnectAttempts: 0,
            messageQueue: [],
          },
          reconnectTimer: null,
          wsUrl: agentChatWsUrl,
        };
        agents.set(agentId, state);
        if (delay === 0) {
          openSocket(state);
        } else {
          setTimeout(() => openSocket(state), delay);
        }
        delay += STAGGER_MS;
      }
      return Promise.resolve();
    },

    send(message: ChatMessage): boolean {
      const state = agents.get(message.agent);
      if (!state) {
        log(`unknown agent: ${message.agent}`);
        return false;
      }

      const { conn } = state;
      if (conn.ws?.readyState === WebSocket.OPEN) {
        conn.ws.send(JSON.stringify(message));
        return true;
      }

      enqueue(state, message);
      return false;
    },

    joinRoom(room: string): void {
      currentRoom = room;
      for (const state of agents.values()) {
        if (state.conn.ws) {
          wsSend(state.conn.ws, `/join ${room}`);
        }
      }
    },

    getStatus(): Record<AgentId, PooledConnection['status']> {
      const result = {} as Record<AgentId, PooledConnection['status']>;
      for (const [id, state] of agents) {
        result[id] = state.conn.status;
      }
      return result;
    },

    getQueuedCount(): number {
      let total = 0;
      for (const state of agents.values()) {
        total += state.conn.messageQueue.length;
      }
      return total;
    },

    async shutdown(): Promise<void> {
      shutdownRequested = true;

      for (const state of agents.values()) {
        // Clear reconnect timers
        if (state.reconnectTimer !== null) {
          clearTimeout(state.reconnectTimer);
          state.reconnectTimer = null;
        }

        // Close WebSocket
        if (state.conn.ws) {
          state.conn.ws.removeAllListeners();
          state.conn.ws.close();
          state.conn.ws = null;
        }

        state.conn.status = 'disconnected';
        state.conn.messageQueue.length = 0;
      }

      agents.clear();
    },
  };

  return pool;
}
