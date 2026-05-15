# agent-chat — Service Context

## Architecture
Two HTTP/WebSocket servers, both bound to `127.0.0.1` only.

| Port | Protocol | Purpose |
|------|----------|---------|
| 4000 | WebSocket | Agent-chat protocol — bridge agents connect here |
| 4001 | HTTP + WebSocket | Dashboard (index.html served via GET /) + browser fan-out |

## Files
- `server.js` (288 lines) — all logic, no build step required
- `public/index.html` — dashboard UI served by the HTTP server

## Key State (in-memory)
| Variable | Type | Purpose |
|----------|------|---------|
| `messageHistory` | `Array<{agent,level,message,timestamp,room}>` | Last 500 messages |
| `agentClients` | `Map<WS, {agentId,msgCount,windowStart}>` | Connected bridge agents |
| `dashboardClients` | `Set<WS>` | Connected browser dashboards |
| `currentRoom` | `string` | Active room name (single global) |

## Agent WebSocket Protocol (port 4000)
1. Connect
2. Send plain-text `agentId` as first message (auth)
3. Server replies `{"type":"ack"}` on success, or closes with 1008 on unknown agent
4. Send `/join <room>` to switch room (pattern: `[a-z0-9-]{1,100}`)
5. Send JSON `ChatMessage` — `{agent, level, message}` — to broadcast

## ChatMessage Validation
- `agent` ∈ `VALID_AGENTS`: `compass`, `fc`, `warden`, `lumen`, `atlas`, `arbiter`
- `level` ∈ `VALID_LEVELS`: `phase`, `decision`, `conversation`
- `message`: non-empty string, max 2000 chars

## Rate Limiting
60 messages per 10-second window per connection. Excess messages silently dropped.

## Dashboard Protocol (port 4001)
- HTTP `GET /` — serves `public/index.html`
- WebSocket connect → immediately receives `{type:"init", room, history:[...]}`
- Receives broadcast `{type:"message", agent, level, message, timestamp, room}` for each new message
- Receives broadcast `{type:"lifecycle", event, timestamp, ...extra}` for room changes and lifecycle events

## Security
- Binds `127.0.0.1` only — not reachable from outside host
- Dashboard renders via `textContent` — no XSS risk from message content
- No auth on dashboard connections (local-only, trusted)

## Starting
```bash
node services/agent-chat/server.js
```
No build step. Requires `ws` npm package.
