#!/bin/bash
# chat-send.sh — Safe fire-and-forget message sender for agent subprocesses.
# Usage: chat-send.sh <agent> <level> <message>
# Uses jq for safe JSON construction — no shell injection possible.
# Fire-and-forget: failures never break agent execution.

set -euo pipefail

agent="${1:-}"
level="${2:-}"
message="${3:-}"

if [ -z "$agent" ] || [ -z "$level" ] || [ -z "$message" ]; then
  exit 0
fi

port="${CHAT_BRIDGE_PORT:-4002}"

# jq --arg safely handles all special characters — no injection vector
body=$(jq -n --arg a "$agent" --arg l "$level" --arg m "$message" \
  '{agent: $a, level: $l, message: $m}')

curl -s --max-time 1 \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$body" \
  "http://127.0.0.1:${port}/send" \
  > /dev/null 2>&1 || true
