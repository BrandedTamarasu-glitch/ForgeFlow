# agent-chat — Service Context

## Architecture
Two HTTP/WebSocket servers, both bound to `127.0.0.1` only.

| Port | Protocol | Purpose |
|------|----------|---------|
| 4000 | WebSocket | Agent-chat protocol — bridge agents connect here |
| 4001 | HTTP + WebSocket | Dashboard (index.html served via GET /) + browser fan-out |

## Files
- `server.js` — all logic, no build step required
- `public/index.html` — dashboard UI served by the HTTP server

## Key State (in-memory)
| Variable | Type | Purpose |
|----------|------|---------|
| `messageHistory` | `Array<{agent,level,message,timestamp,room}>` | Last 500 messages |
| `agentClients` | `Map<WS, {agentId,msgCount,windowStart}>` | Connected bridge agents |
| `dashboardClients` | `Set<WS>` | Connected browser dashboards |
| `currentRoom` | `string` | Active room name (single global) |

## Agent WebSocket Protocol (port 4000)
1. Connect with `X-Forgeflow-Token` from the private session credential file. Missing/invalid tokens fail the HTTP upgrade.
2. Send plain-text `agentId` as the first message (identity selection after authentication)
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
- HTTP `GET /` — serves `public/index.html` and sets an HttpOnly, SameSite=Strict session cookie. Cross-origin requests are rejected.
- Authenticated same-origin WebSocket connect → immediately receives `{type:"init", room, history:[...]}`
- Receives broadcast `{type:"message", agent, level, message, timestamp, room}` for each new message
- Receives broadcast `{type:"lifecycle", event, timestamp, ...extra}` for room changes and lifecycle events

## Security
- Binds `127.0.0.1` only — not reachable from outside host
- Dashboard renders via `textContent` — no XSS risk from message content
- Every HTTP request and WebSocket upgrade validates the exact loopback Host and any Origin; browser cross-site Fetch Metadata is rejected.
- Agent upgrades require a random session credential, persisted mode 0600 at `${TMPDIR:-/tmp}/agent-chat-<uid>.token`. `AGENT_CHAT_TOKEN_FILE` overrides its location for both server and first-party clients.
- The local metrics dashboard may proxy the read-only chat WebSocket using the private agent credential header; the proxy must enforce its own same-origin browser boundary.
- Browser history/export requires the separate session cookie. Cookie-authenticated `POST /clear` additionally requires the exact dashboard Origin; local CLI HTTP requests use the agent credential header.
- Credential files are read using no-follow file descriptors with owner, mode, and regular-file checks. Credentials rotate when the server restarts, are removed on clean shutdown, and never appear in HTML, URLs, or logs.
- `session-auth.js` is shared by the server, debate client, and `client.js` export reader. The bridge re-reads the upstream token on reconnect.
- Open the dashboard directly at `http://127.0.0.1:4001` or `http://localhost:4001`; reload after a server restart to refresh the browser cookie.
- `createAgentChatServer({agentPort, dashboardPort, tokenFile, autoSavePath, logger})` permits port 0 and disposable test state without starting the normal service on import.

## Starting
```bash
node services/agent-chat/server.js
```
No build step. Requires `ws` npm package.

## Validation
`node --test services/agent-chat/__tests__/*.test.js` exercises local ephemeral listeners for credential success/failure, Host/Origin rejection, browser history/clear protection, and rotation. Bridge integration tests additionally verify authenticated agent delivery.
