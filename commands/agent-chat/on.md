---
name: agent-chat:on
description: Start the agent-chat server (ports 4000 + 4001) as a background daemon. Safe to run if already running — reports status and exits cleanly.
argument-hint: ""
allowed-tools:
  - Bash
---
<objective>
Start the agent-chat WebSocket + dashboard server as a background daemon. Resolve the repo root, check if already running, start if not, wait for it to be ready, then report the dashboard URL.
</objective>

<process>

## Step 1 — Resolve repo root

```bash
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
```

If empty, stop: `"Cannot resolve repo root. Run this command from inside the Forgeflow repo."`

```bash
SERVER_JS="$REPO_ROOT/services/agent-chat/server.js"
PID_FILE="/tmp/agent-chat.pid"
LOG_FILE="/tmp/agent-chat.log"
```

Verify `$SERVER_JS` exists:
```bash
[ -f "$SERVER_JS" ] || echo "Server not found at $SERVER_JS" && exit 1
```

## Step 2 — Check if already running

```bash
ALREADY_RUNNING=false
if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || echo "")"
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    ALREADY_RUNNING=true
  fi
fi
```

If `ALREADY_RUNNING=true`, print:
```
agent-chat already running (PID $PID)
  Agent WS:  ws://127.0.0.1:4000
  Dashboard: http://127.0.0.1:4001
```
and stop.

## Step 3 — Start server

```bash
nohup node "$SERVER_JS" >> "$LOG_FILE" 2>&1 &
PID=$!
echo "$PID" > "$PID_FILE"
```

## Step 4 — Wait for ready

Poll `http://127.0.0.1:4001/` up to 5 seconds (50 × 100ms):

```bash
READY=false
for i in $(seq 1 50); do
  if curl -sf --max-time 0.5 "http://127.0.0.1:4001/" > /dev/null 2>&1; then
    READY=true
    break
  fi
  sleep 0.1
done
```

If `READY=false` after timeout, print:
```
agent-chat server did not start within 5s (PID $PID). Check log: /tmp/agent-chat.log
```
and stop.

## Step 5 — Report

```
agent-chat started (PID $PID)
  Agent WS:  ws://127.0.0.1:4000
  Dashboard: http://127.0.0.1:4001
  Log:       /tmp/agent-chat.log

Run /agent-chat:off when done — it will prompt to save the chat log as markdown before stopping.
```

</process>

<success_criteria>
- [ ] Reports cleanly if already running — does not start a second instance
- [ ] Starts server as background daemon (nohup) with output to /tmp/agent-chat.log
- [ ] Writes PID to /tmp/agent-chat.pid
- [ ] Polls dashboard HTTP endpoint to confirm ready before reporting success
- [ ] Reports Agent WS and Dashboard URLs on success
- [ ] Reports log path on startup failure
</success_criteria>
