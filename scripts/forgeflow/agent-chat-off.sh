#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
CUSTOM_DEST="${2:-}"
PID_FILE="/tmp/agent-chat.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "agent-chat is not running (no PID file found)."
  exit 0
fi

PID="$(cat "$PID_FILE" 2>/dev/null || true)"
if [ -z "${PID:-}" ] || ! kill -0 "$PID" 2>/dev/null; then
  rm -f "$PID_FILE"
  echo "agent-chat is not running (stale PID file removed)."
  exit 0
fi

INFO="$(curl -sf --max-time 2 "http://127.0.0.1:4001/auto-save-path" || true)"
AUTO_SAVE_PATH="$(printf '%s' "$INFO" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('path',''))" 2>/dev/null || true)"
MSG_COUNT="$(printf '%s' "$INFO" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('messages',0))" 2>/dev/null || echo "0")"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
mkdir -p "$REPO_ROOT/.forgeflow"
ROOM="$(curl -sf --max-time 2 "http://127.0.0.1:4001/export" | grep '^\*\*Room:\*\*' | sed 's/\*\*Room:\*\* //' | tr ' ' '-' || echo "session")"
DATE_STR="$(date +%Y-%m-%d-%H%M)"
DEFAULT_DEST="$REPO_ROOT/.forgeflow/agent-chat-${ROOM}-${DATE_STR}.md"

if [ "${MSG_COUNT:-0}" != "0" ] && [ -n "${AUTO_SAVE_PATH:-}" ]; then
  case "$MODE" in
    --copy-default)
      mkdir -p "$(dirname "$DEFAULT_DEST")"
      cp "$AUTO_SAVE_PATH" "$DEFAULT_DEST"
      echo "Chat log copied to $DEFAULT_DEST (also kept at $AUTO_SAVE_PATH)"
      ;;
    --copy)
      if [ -z "$CUSTOM_DEST" ]; then
        echo "--copy requires a destination path" >&2
        exit 1
      fi
      mkdir -p "$(dirname "$CUSTOM_DEST")"
      cp "$AUTO_SAVE_PATH" "$CUSTOM_DEST"
      echo "Chat log copied to $CUSTOM_DEST (also kept at $AUTO_SAVE_PATH)"
      ;;
    *)
      echo "Auto-saved chat log: $AUTO_SAVE_PATH ($MSG_COUNT messages)"
      echo "Suggested permanent path: $DEFAULT_DEST"
      ;;
  esac
fi

kill "$PID" 2>/dev/null || true

STOPPED=false
for _ in $(seq 1 50); do
  if ! kill -0 "$PID" 2>/dev/null; then
    STOPPED=true
    break
  fi
  sleep 0.1
done

if [ "$STOPPED" != "true" ]; then
  kill -9 "$PID" 2>/dev/null || true
  echo "agent-chat (PID $PID) did not exit cleanly — force-killed."
else
  echo "agent-chat stopped (PID $PID)."
fi

rm -f "$PID_FILE"
