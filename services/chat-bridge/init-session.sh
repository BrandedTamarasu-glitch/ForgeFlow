#!/bin/bash
# init-session.sh — Sourced by command files before agent spawning.
# Sets: CHAT_SEND, ROOM_NAME, CHAT_AVAILABLE
# Usage: source init-session.sh "consult" "$ARGUMENTS"

COMMAND_NAME="${1:-session}"
ARGUMENTS="${2:-}"

# ---------------------------------------------------------------------------
# Resolve project root
# ---------------------------------------------------------------------------

SUBAGENTS_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "")"
if [ -z "$SUBAGENTS_ROOT" ]; then
  CHAT_AVAILABLE=false
  CHAT_SEND=""
  ROOM_NAME="unknown"
  export CHAT_AVAILABLE CHAT_SEND ROOM_NAME
  return 0 2>/dev/null || exit 0
fi

# ---------------------------------------------------------------------------
# PID / ready file paths (namespaced by repo root)
# ---------------------------------------------------------------------------

REPO_HASH="$(echo "$SUBAGENTS_ROOT" | sha256sum | cut -c1-8)"
PID_FILE="/tmp/chat-bridge-${REPO_HASH}.pid"
READY_FILE="/tmp/chat-bridge-${REPO_HASH}.ready"

CHAT_BRIDGE_PORT="${CHAT_BRIDGE_PORT:-4002}"

# ---------------------------------------------------------------------------
# Generate ROOM_NAME from command + arguments
# ---------------------------------------------------------------------------

# Lowercase, replace non-alnum with hyphens, collapse runs, take first 5 tokens
ROOM_SLUG="$(echo "$ARGUMENTS" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/-\+/-/g; s/^-//; s/-$//' | tr '-' '\n' | head -n 5 | paste -sd '-' -)"
if [ -n "$ROOM_SLUG" ]; then
  ROOM_NAME="${COMMAND_NAME}-${ROOM_SLUG}"
else
  ROOM_NAME="${COMMAND_NAME}"
fi
# Truncate to 100 chars to match ROOM_NAME_REGEX
ROOM_NAME="${ROOM_NAME:0:100}"

# ---------------------------------------------------------------------------
# Bridge startup / health check
# ---------------------------------------------------------------------------

BRIDGE_ALIVE=false

# 1. Check PID file exists AND process alive
if [ -f "$PID_FILE" ]; then
  BRIDGE_PID="$(cat "$PID_FILE" 2>/dev/null || echo "")"
  if [ -n "$BRIDGE_PID" ] && kill -0 "$BRIDGE_PID" 2>/dev/null; then
    # 2. Health check
    if curl -sf --max-time 0.5 "http://127.0.0.1:${CHAT_BRIDGE_PORT}/status" > /dev/null 2>&1; then
      BRIDGE_ALIVE=true
    fi
  fi
fi

# 3. Start bridge if not alive or not healthy
if [ "$BRIDGE_ALIVE" = false ]; then
  BRIDGE_JS="$SUBAGENTS_ROOT/services/chat-bridge/dist/bridge.js"
  if [ -f "$BRIDGE_JS" ]; then
    node "$BRIDGE_JS" &
    BRIDGE_PID=$!

    # 4. Write PID file and root companion
    echo "$BRIDGE_PID" > "$PID_FILE"
    echo "$SUBAGENTS_ROOT" > "${PID_FILE}.root"

    # 5. Poll for ready file: 100ms intervals, configurable timeout (default 3s)
    BRIDGE_STARTUP_TIMEOUT="${BRIDGE_STARTUP_TIMEOUT:-3}"
    MAX_ITERATIONS=$(( BRIDGE_STARTUP_TIMEOUT * 10 ))
    WAITED=0
    while [ "$WAITED" -lt "$MAX_ITERATIONS" ]; do
      if [ -f "$READY_FILE" ]; then
        BRIDGE_ALIVE=true
        break
      fi
      sleep 0.1
      WAITED=$((WAITED + 1))
    done
  fi
fi

# ---------------------------------------------------------------------------
# Export results
# ---------------------------------------------------------------------------

if [ "$BRIDGE_ALIVE" = true ]; then
  CHAT_AVAILABLE=true
else
  CHAT_AVAILABLE=false
fi

CHAT_SEND="$SUBAGENTS_ROOT/services/chat-bridge/chat-send.sh"

export CHAT_AVAILABLE CHAT_SEND ROOM_NAME SUBAGENTS_ROOT

# ---------------------------------------------------------------------------
# Room creation + lifecycle event (only if chat is up)
# ---------------------------------------------------------------------------

if [ "$CHAT_AVAILABLE" = true ]; then
  # Create room
  curl -s --max-time 1 \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg name "$ROOM_NAME" '{name: $name}')" \
    "http://127.0.0.1:${CHAT_BRIDGE_PORT}/room" \
    > /dev/null 2>&1 || true

  # Lifecycle: phase_start — only fire once per bridge process
  SESSION_MARKER="/tmp/chat-session-${REPO_HASH}-${BRIDGE_PID}.started"
  if [ ! -f "$SESSION_MARKER" ]; then
    touch "$SESSION_MARKER"
    curl -s --max-time 1 \
      -X POST \
      -H "Content-Type: application/json" \
      -d "$(jq -n --arg event "phase_start" --arg data "$COMMAND_NAME" '{event: $event, data: $data}')" \
      "http://127.0.0.1:${CHAT_BRIDGE_PORT}/lifecycle" \
      > /dev/null 2>&1 || true
  fi
fi
