// chat-bridge/types.ts — Shared types, constants, type guards, and input parsers.
// Zero external dependencies. All validation is strict and returns null on failure.

import type { WebSocket } from 'ws';

// ---------------------------------------------------------------------------
// Core domain types
// ---------------------------------------------------------------------------

export type AgentId = 'compass' | 'fc' | 'warden' | 'lumen' | 'atlas' | 'arbiter';
export type VerbosityLevel = 'phase' | 'decision' | 'conversation';

export interface ChatMessage {
  readonly agent: AgentId;
  readonly level: VerbosityLevel;
  readonly message: string;
  readonly timestamp: number;
  readonly room: string;
}

// ---------------------------------------------------------------------------
// HTTP request / response shapes
// ---------------------------------------------------------------------------

export interface SendRequest { agent: AgentId; message: string; level: VerbosityLevel; }
export interface SendResponse { ok: boolean; filtered?: boolean; error?: string; }
export interface RoomRequest { name: string; }
export interface RoomResponse { ok: boolean; room: string; error?: string; }
export interface LifecycleRequest { event: string; agent?: AgentId; data?: string; }
export interface LifecycleResponse { ok: boolean; error?: string; }

export interface StatusResponse {
  ok: boolean;
  connections: Record<AgentId, 'connected' | 'reconnecting' | 'disconnected'>;
  currentRoom: string;
  verbosity: VerbosityLevel;
  uptime: number;
  queuedMessages: number;
}

export interface VerbosityResponse { ok: boolean; level: VerbosityLevel; previous: VerbosityLevel; }

// ---------------------------------------------------------------------------
// Connection pool
// ---------------------------------------------------------------------------

export interface PooledConnection {
  readonly agentId: AgentId;
  ws: WebSocket | null;
  status: 'connected' | 'reconnecting' | 'disconnected';
  reconnectAttempts: number;
  messageQueue: ChatMessage[];
}

// ---------------------------------------------------------------------------
// Bridge configuration
// ---------------------------------------------------------------------------

export interface BridgeConfig {
  readonly agentChatHost: string;       // default '127.0.0.1'
  readonly agentChatHttpPort: number;   // default 4000
  readonly bridgeHost: string;          // default '127.0.0.1'
  readonly bridgePort: number;          // default 4002
  readonly pidFile: string;
  readonly readyFile: string;
  readonly maxQueuePerAgent: number;    // default 100
  readonly maxMessageLength: number;    // default 2000
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const VALID_AGENTS: readonly AgentId[] = [
  'compass', 'fc', 'warden', 'lumen', 'atlas', 'arbiter',
] as const;

export const VALID_LEVELS: readonly VerbosityLevel[] = [
  'phase', 'decision', 'conversation',
] as const;

export const ROOM_NAME_REGEX = /^[a-z0-9-]{1,100}$/;

export const VERBOSITY_RANK: Record<VerbosityLevel, number> = {
  phase: 0,
  decision: 1,
  conversation: 2,
} as const;

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isAgentId(value: unknown): value is AgentId {
  return typeof value === 'string' && (VALID_AGENTS as readonly string[]).includes(value);
}

export function isVerbosityLevel(value: unknown): value is VerbosityLevel {
  return typeof value === 'string' && (VALID_LEVELS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Validates and narrows a request body to SendRequest.
 * Enforces: agent in allowlist, level valid, message is a non-empty string
 * with length <= 2000 characters.
 */
export function parseSendRequest(body: unknown): SendRequest | null {
  if (!isObject(body)) return null;

  const { agent, message, level } = body;

  if (!isAgentId(agent)) return null;
  if (!isVerbosityLevel(level)) return null;
  if (typeof message !== 'string') return null;
  if (message.length === 0 || message.length > 2000) return null;

  return { agent, message, level };
}

/**
 * Validates and narrows a request body to RoomRequest.
 * Enforces: name matches ROOM_NAME_REGEX (lowercase alphanumeric + hyphens, 1-100 chars).
 */
export function parseRoomRequest(body: unknown): RoomRequest | null {
  if (!isObject(body)) return null;

  const { name } = body;

  if (typeof name !== 'string') return null;
  if (!ROOM_NAME_REGEX.test(name)) return null;

  return { name };
}

/**
 * Validates and narrows a request body to LifecycleRequest.
 * Enforces: event is a non-empty string. Optional agent must be valid if present.
 * Optional data must be a string if present.
 */
export function parseLifecycleRequest(body: unknown): LifecycleRequest | null {
  if (!isObject(body)) return null;

  const { event, agent, data } = body;

  if (typeof event !== 'string' || event.length === 0) return null;

  if (agent !== undefined && !isAgentId(agent)) return null;
  if (data !== undefined && typeof data !== 'string') return null;

  const result: LifecycleRequest = { event };
  if (isAgentId(agent)) result.agent = agent;
  if (typeof data === 'string') result.data = data;

  return result;
}

/**
 * Validates and narrows a request body to VerbosityRequest.
 * Enforces: level is a valid VerbosityLevel string.
 */
export function parseVerbosityRequest(body: unknown): { level: VerbosityLevel } | null {
  if (!isObject(body)) return null;

  const { level } = body;

  if (!isVerbosityLevel(level)) return null;

  return { level };
}
