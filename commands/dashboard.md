---
name: dashboard
description: Start the Forgeflow metrics dashboard (port 4003). Three-column layout — project list (left), verdict trend chart + stats (center), live agent chat (right). Reads forgeflow-metrics.jsonl telemetry. To stop: kill $(cat /tmp/dashboard.pid)
allowed-tools: [Bash]
---

## Usage
`node services/dashboard/server.js` — starts server at http://127.0.0.1:4003
To stop: `kill $(cat /tmp/dashboard.pid)` or Ctrl+C if running in foreground.

## Step 1 — Resolve repo root
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
SERVER_JS="$REPO_ROOT/services/dashboard/server.js"
PID_FILE="/tmp/dashboard.pid"
LOG_FILE="/tmp/dashboard.log"

## Step 2 — Check if already running
if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE")"; if kill -0 "$PID" 2>/dev/null; then ALREADY_RUNNING=true; fi
fi
If ALREADY_RUNNING: print status with PID and URL, then stop.

## Step 3 — Start server
nohup node "$SERVER_JS" >> "$LOG_FILE" 2>&1 &
PID=$!; echo "$PID" > "$PID_FILE"

## Step 4 — Wait for ready
Poll http://127.0.0.1:4003/ up to 5s (50 × 100ms via curl -sf).

## Step 5 — Report
"Dashboard started (PID $PID)\n  http://127.0.0.1:4003\n  Stop: kill $(cat /tmp/dashboard.pid)"
