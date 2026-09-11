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
| POST | `/send` | Route chat message — `{agent, level, message, activityLabel?}` |
| POST | `/lifecycle` | Broadcast lifecycle event — `{event: string, data?: string, agent?, state?, activityLabel?}` |
| POST | `/verbosity` | Change verbosity threshold — `{level: "phase"|"decision"|"conversation"}` |
| GET | `/health` | Unauthenticated liveness probe — returns `{ok:true}` |
| GET | `/status` | Authenticated bridge state — returns connections, room, verbosity, uptime, queued count |

## Key Types (types.ts)
`AgentId`, `VerbosityLevel`, `ChatMessage`, `SendRequest/Response`, `RoomRequest/Response`, `LifecycleRequest/Response`, `BridgeConfig`, `StatusResponse`, `VerbosityResponse`

## Field Constraints
| Field | Limit | Behaviour on exceed |
|-------|-------|---------------------|
| `event` (lifecycle) | 500 chars | 400 rejected |
| Complete lifecycle message | 2000 UTF-16 code units, including `[lifecycle] `, event, separator, and data | 400 rejected before queueing; evidence is never truncated |
| `message` (send) | 2000 chars | Silently truncated before validation |

## Verbosity Filter
`shouldPass(messageLevel, threshold)`: only messages ≥ threshold pass.
Order: `phase` > `decision` > `conversation`. Default threshold: `decision`.
Filtered sends return `{ok:true, filtered:true}` — not an error.

## ConnectionPool (connections.ts)
- One WS connection per agent to port 4000
- Per-agent queue (max 100 messages) — messages held until authenticated upgrade and identity ACK
- Automatic reconnect on disconnect, re-reading the private agent-chat session token each time; no queued message is sent before ACK
- `pool.send(ChatMessage)` — routes to correct agent connection
- `pool.joinRoom(name)` — sends `/join <name>` on all connections
- `pool.getStatus()` / `pool.getQueuedCount()` — for /status endpoint
- `pool.shutdown()` — graceful close, returns Promise

## Lifecycle Sender
Lifecycle events without an explicit role use the `system` sender.

## Startup / Ready File
- PID file: `/tmp/chat-bridge-<hash>.pid`
- Ready file: `/tmp/chat-bridge-<hash>.ready` — written after HTTP server binds; deleted on shutdown
- Token file: `/tmp/chat-bridge-<hash>.token` — per-repo control token for `/room`, `/send`, `/lifecycle`, `/verbosity`, and `/status`
- Upstream token: `${TMPDIR:-/tmp}/agent-chat-<uid>.token`, or `AGENT_CHAT_TOKEN_FILE`; separate from the bridge control token. Header authentication keeps it out of URLs and logs.
- Every HTTP request pins Host to its listener and rejects foreign Origin/Fetch Metadata.
- Hash: SHA-256 of `process.cwd()`, first 8 hex chars — ties file names to repo location

## init-session.sh
Idempotent via `SESSION_MARKER=/tmp/chat-session-${REPO_HASH}-${BRIDGE_PID}.started`.
Hashing uses the repo path without a trailing newline; startup runs from that root. Shell clients pass the control header on curl stdin, keeping credentials out of process arguments.
Steps: start bridge → poll ready file → POST /room → POST /lifecycle `phase_start`.
Source into agent shells (`. init-session.sh`) so env vars propagate.

## Starting
```bash
cd services/chat-bridge && node --import=tsx/esm bridge.ts
# or via init-session.sh from repo root
```

## Ember activity

`POST /lifecycle` also accepts optional `agent` and `state`. Valid states are `idle`, `planning`, `researching`, `implementing`, `reviewing`, `testing`, `waiting`, `failed`, and `complete`. For example, `{event:"phase_start",agent:"product_lead",state:"planning",data:"Planning the feature"}` emits the existing lifecycle chat message plus structured activity. The state is not inferred from prose. The label comes from data (or event), capped at 160 characters. Omitting `agent` uses `system`; omitting `state` preserves chat-only behavior.

`init-session.sh` emits `phase_start` on every workflow invocation, including reuse of a running bridge. Known command names explicitly report planning, researching, implementing, or reviewing. Unknown command names emit chat only. This is a phase-start integration: callers should send progress updates during long work, and explicit waiting/failure/completion when appropriate. Ember marks active reports stale after 90 seconds without updates.

Workflow initialization now calls the shared dashboard launcher with `--workflow <command>`. It ensures the live service and reports a known phase on each entry while deduplicating browser tabs by host session. Unknown workflow names do not invent a phase.

Messages accept optional `activityLabel` context: trimmed, nonempty, at most 120 characters, with no control characters. This context belongs to the message and survives history, replay, and export; it is separate from the live `activity` state. Known legacy aliases normalize to canonical roles. Verifier (`verifier`) has the same transport support as other roles. Unknown roles remain rejected; `system` is reserved for generic orchestration.

## Profile registration

`registerProfiles` is currently unused because the upstream has no profile endpoint. Each concurrent registration uses a five-second abort timeout, logs failure, and settles without throwing.
