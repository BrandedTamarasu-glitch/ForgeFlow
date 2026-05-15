#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SERVER_JS="$REPO_ROOT/services/agent-chat/server.js"
PID_FILE="/tmp/agent-chat.pid"
LOG_FILE="/tmp/agent-chat.log"

if [ ! -f "$SERVER_JS" ]; then
  echo "Server not found at $SERVER_JS" >&2
  exit 1
fi

if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "${PID:-}" ] && kill -0 "$PID" 2>/dev/null; then
    cat <<EOF
agent-chat already running (PID $PID)
  Agent WS:  ws://127.0.0.1:4000
  Dashboard: http://127.0.0.1:4001
EOF
    exit 0
  fi
fi

setsid nohup node "$SERVER_JS" >> "$LOG_FILE" 2>&1 < /dev/null &
PID=$!
echo "$PID" > "$PID_FILE"

READY=false
for _ in $(seq 1 50); do
  if curl -sf --max-time 0.5 "http://127.0.0.1:4001/" > /dev/null 2>&1; then
    READY=true
    break
  fi
  sleep 0.1
done

if [ "$READY" != "true" ]; then
  echo "agent-chat server did not start within 5s (PID $PID). Check log: $LOG_FILE" >&2
  exit 1
fi

cat <<EOF
agent-chat started (PID $PID)
  Agent WS:  ws://127.0.0.1:4000
  Dashboard: http://127.0.0.1:4001
  Log:       $LOG_FILE
EOF
