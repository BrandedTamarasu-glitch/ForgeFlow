---
name: agent-chat:off
description: Stop the agent-chat server if it is running. If messages were captured, prompts to copy the log from /tmp to a permanent location before stopping. Safe to run if not running — reports status and exits cleanly.
argument-hint: ""
allowed-tools:
  - Bash
---
<objective>
Gracefully stop the agent-chat server. The server auto-saves the log to /tmp on every 10 messages and on shutdown — notes are never lost. Before stopping, fetch the auto-save path and offer to copy the log to a permanent location. Read the PID file, verify the process is alive, send SIGTERM, wait for clean exit, and clean up.
</objective>

<process>

## Step 1 — Find the process

```bash
PID_FILE="/tmp/agent-chat.pid"
```

If `$PID_FILE` does not exist:
```
agent-chat is not running (no PID file found).
```
Stop.

```bash
PID="$(cat "$PID_FILE" 2>/dev/null || echo "")"
```

If `PID` is empty or `kill -0 "$PID" 2>/dev/null` fails:
```
agent-chat is not running (PID file exists but process $PID is gone).
```
Remove the stale PID file: `rm -f "$PID_FILE"`
Stop.

## Step 2 — Offer to copy the auto-saved log to a permanent location

```bash
INFO="$(curl -sf --max-time 2 "http://127.0.0.1:4001/auto-save-path" || echo "")"
```

Parse the auto-save path and message count:
```bash
AUTO_SAVE_PATH="$(echo "$INFO" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['path'])" 2>/dev/null || echo "")"
MSG_COUNT="$(echo "$INFO" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['messages'])" 2>/dev/null || echo "0")"
```

If `MSG_COUNT` is 0 or `AUTO_SAVE_PATH` is empty, skip the copy prompt and proceed to Step 3.

If `MSG_COUNT` > 0:

Resolve a permanent destination:
```bash
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$HOME")"
ROOM="$(curl -sf --max-time 1 "http://127.0.0.1:4001/auto-save-path" | python3 -c "import json,sys; ..." 2>/dev/null || echo "session")"
DATE_STR="$(date +%Y-%m-%d-%H%M)"
SAFE_ROOM="$(echo "$ROOM" | tr '/' '-' | tr ' ' '-')"
DEFAULT_DEST="${REPO_ROOT}/.forgeflow/agent-chat-${SAFE_ROOM}-${DATE_STR}.md"
```

Fetch the room name from the export header for the default filename:
```bash
ROOM="$(curl -sf --max-time 2 "http://127.0.0.1:4001/export" | grep '^\*\*Room:\*\*' | sed 's/\*\*Room:\*\* //' | tr ' ' '-' || echo "session")"
```

Tell the user: **"Chat log auto-saved to `$AUTO_SAVE_PATH` ($MSG_COUNT messages). Copy to permanent location? Default: `$DEFAULT_DEST` (yes / no / custom path)"**

- **yes** — copy to `$DEFAULT_DEST`
- **no** — leave at `$AUTO_SAVE_PATH` (survives until next session overwrites it)
- **custom path** — copy to the path the user provides

To copy:
```bash
mkdir -p "$(dirname "$DEST")"
cp "$AUTO_SAVE_PATH" "$DEST"
```
Confirm: `Chat log copied to $DEST (also kept at $AUTO_SAVE_PATH)`

## Step 3 — Stop the server

```bash
kill "$PID"
```

Wait up to 5 seconds for the process to exit (50 × 100ms):

```bash
STOPPED=false
for i in $(seq 1 50); do
  if ! kill -0 "$PID" 2>/dev/null; then
    STOPPED=true
    break
  fi
  sleep 0.1
done
```

If `STOPPED=false` after timeout, send SIGKILL:
```bash
kill -9 "$PID" 2>/dev/null || true
```
Then print: `agent-chat (PID $PID) did not exit cleanly — force-killed.`

## Step 4 — Clean up and report

```bash
rm -f "$PID_FILE"
```

If stopped cleanly:
```
agent-chat stopped (PID $PID).
```

</process>

<success_criteria>
- [ ] Reports cleanly if not running — no error, no crash
- [ ] Fetches auto-save path and message count from GET /auto-save-path
- [ ] Skips copy prompt if no messages
- [ ] Informs user the log is already at AUTO_SAVE_PATH; prompts to copy to permanent location
- [ ] Accepts yes / no / custom path response
- [ ] Copies to chosen path (cp, not mv — original stays in /tmp until overwritten by next session)
- [ ] Sends SIGTERM for graceful shutdown; falls back to SIGKILL after 5s
- [ ] Removes /tmp/agent-chat.pid on exit
- [ ] Reports save path and stop outcome
</success_criteria>
