# chat-bridge — Service Context

## Architecture
HTTP control plane on `127.0.0.1:4002`. Bridges HTTP callers (shell scripts, agents) → agent-chat WS server (port 4000) via a connection pool.

## Files
| File | Lines | Purpose |
|------|-------|---------|
| `bridge.ts` | 424 | HTTP server, request router, startup/shutdown |
| `connections.ts` | — | `ConnectionPool` — per-agent WS connections, queues, reconnect logic |
| `types.ts` | — | Type definitions and request parsers |
| `verbosity.js` | — | `shouldPass(level, threshold)` filter |
| `init-session.sh` | — | Shell bootstrap: starts bridge, polls ready file, sets room, fires `phase_start` |

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/room` | Switch active room — `{name: string}` matching `[a-z0-9-]{1,100}` |
| POST | `/send` | Route chat message — `{agent, level, message}` |
| POST | `/lifecycle` | Broadcast lifecycle event — `{event: string, data?: string}` |
| POST | `/verbosity` | Change verbosity threshold — `{level: "phase"|"decision"|"conversation"}` |
| GET | `/status` | Health check — returns connections, room, verbosity, uptime, queued count |

## Key Types (types.ts)
`AgentId`, `VerbosityLevel`, `ChatMessage`, `SendRequest/Response`, `RoomRequest/Response`, `LifecycleRequest/Response`, `BridgeConfig`, `StatusResponse`, `VerbosityResponse`

## Field Constraints
| Field | Limit | Behaviour on exceed |
|-------|-------|---------------------|
| `event` (lifecycle) | 500 chars | 400 rejected |
| `data` (lifecycle) | 2000 chars | 400 rejected |
| `message` (send) | 2000 chars | Silently truncated before validation |

## Verbosity Filter
`shouldPass(messageLevel, threshold)`: only messages ≥ threshold pass.
Order: `phase` > `decision` > `conversation`. Default threshold: `decision`.
Filtered sends return `{ok:true, filtered:true}` — not an error.

## ConnectionPool (connections.ts)
- One WS connection per agent to port 4000
- Per-agent queue (max 100 messages) — messages held until connection is OPEN
- Automatic reconnect on disconnect
- `pool.send(ChatMessage)` — routes to correct agent connection
- `pool.joinRoom(name)` — sends `/join <name>` on all connections
- `pool.getStatus()` / `pool.getQueuedCount()` — for /status endpoint
- `pool.shutdown()` — graceful close, returns Promise

## Lifecycle Sender
Lifecycle events always use agent `'fc'` as sender (hardcoded in `broadcastLifecycle()`).

## Startup / Ready File
- PID file: `/tmp/chat-bridge-<hash>.pid`
- Ready file: `/tmp/chat-bridge-<hash>.ready` — written after HTTP server binds; deleted on shutdown
- Hash: SHA-256 of `process.cwd()`, first 8 hex chars — ties file names to repo location

## init-session.sh
Idempotent via `SESSION_MARKER=/tmp/chat-session-${REPO_HASH}-${BRIDGE_PID}.started`.
Steps: start bridge → poll ready file → POST /room → POST /lifecycle `phase_start`.
Source into agent shells (`. init-session.sh`) so env vars propagate.

## Starting
```bash
cd services/chat-bridge && node --import=tsx/esm bridge.ts
# or via init-session.sh from repo root
```
