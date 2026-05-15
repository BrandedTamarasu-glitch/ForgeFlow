# Compass — Validation Test Plan: Wave 3 (init-session.sh integration)

## Test Infrastructure
- Framework: Bash (manual) + automated regression script
- Test directory: /home/user/example-project/tests/
- Regression script: bash /home/user/example-project/tests/validate-wave3.sh
- Manual smoke test: steps below, requires dashboard running at http://127.0.0.1:4001

---

## 1. Smoke Test (manual — required before merge)

**Purpose:** Verify that running `/discuss "test"` with the bridge running produces a
`phase_start` lifecycle event visible in the dashboard.

**Preconditions:**
- The bridge compiled artifact exists at:
  `/home/user/example-project/services/chat-bridge/dist/bridge.js`
- The agent-chat server is running (port 4001 dashboard, port 4000 agent WS)
- A browser has the dashboard open at http://127.0.0.1:4001

**Steps:**

1. Open the dashboard in a browser at http://127.0.0.1:4001.
   Verify the page loads without a console error. The room indicator should show
   "default" or whatever the current room is.

2. Open a second terminal. Confirm the bridge is NOT already running:
   ```
   curl -s http://127.0.0.1:4002/status
   ```
   If you get a response, note the current room — it will change in step 4.
   If you get "Connection refused", the bridge is down (tests the auto-start path).

3. In your working directory, trigger the discuss command with a short argument:
   ```
   /discuss "test"
   ```
   (The Claude slash-command runner will source the bash block in discuss.md.)

4. Within 3 seconds of the command starting, observe the dashboard:
   - A lifecycle event row must appear. The event type is `phase_start`.
   - The data field in that event must be the string `discuss`.
   - Expected display (exact wording depends on dashboard UI):
     `[lifecycle] phase_start — discuss`

5. Check the room name. In the dashboard room indicator or in a lifecycle
   `room-changed` event, the room must be:
   - `discuss-test` (argument "test" slugified and appended to command name)

6. In the terminal where you ran the command, look for bridge log output.
   The bridge writes to stderr; if it auto-started you will see lines like:
   ```
   [bridge] listening on 127.0.0.1:4002
   [bridge] ready file written: /tmp/chat-bridge-<hash>.ready
   [bridge] room changed to discuss-test
   ```

**Pass criteria:**
- [ ] Dashboard shows a `phase_start` lifecycle event with data=`discuss`
- [ ] ROOM_NAME in bridge logs is `discuss-test`
- [ ] Bridge auto-started if it was not already running (ready file appeared)
- [ ] Command continued to execute (discuss agents spawned) — bridge failure is non-fatal

---

## 2. Regression Matrix (automated)

Run:
```bash
bash /home/user/example-project/tests/validate-wave3.sh
```

Expected output: `Results: 49 passed, 0 failed`

The script checks each of the 7 files for:

| Check | Description |
|-------|-------------|
| Source line present | `grep` for `source.*init-session\.sh` |
| Source line form correct | Canonical git-rev-parse path, correct command name string, `"$*"` argument |
| Command name matches file name | Extracted embedded name equals `<filename>.md` basename |
| YAML front matter parseable | `name:` field present and non-empty between the two `---` markers |
| `<objective>` tag present | Structural integrity of the command body |
| Source line position | Line number of source line is greater than the closing `---` of YAML |

### File-to-command-name mapping verified by the script:

| File | Expected embedded command name |
|------|-------------------------------|
| consult.md | consult |
| discuss.md | discuss |
| research.md | research |
| plan.md | plan |
| implement.md | implement |
| review.md | review |
| ship.md | ship |

---

## 3. Edge Case Verification (manual)

### Edge case A: ROOM_NAME slug sanitization with special characters
**Scenario:** `/review HEAD~3`
**Expected ROOM_NAME:** `review-head-3`

**Why:** `init-session.sh` applies:
```
tr '[:upper:]' '[:lower:]'   → head~3
sed 's/[^a-z0-9]/-/g'        → head-3   (~ becomes -)
s/-\+/-/g                     → head-3   (no runs to collapse)
```
Then prefixed with command name: `review-head-3`

**Verification steps:**
1. Start the bridge or confirm it is running.
2. In a second terminal, manually invoke the source line from review.md:
   ```bash
   source /home/user/example-project/services/chat-bridge/init-session.sh "review" "HEAD~3"
   echo "ROOM_NAME=$ROOM_NAME"
   ```
3. Confirm output is: `ROOM_NAME=review-head-3`
4. Confirm the dashboard shows a `room-changed` event with room=`review-head-3`.

**Pass criteria:**
- [ ] `echo $ROOM_NAME` outputs `review-head-3`
- [ ] Dashboard room-changed event shows `review-head-3`

---

### Edge case B: No arguments — ROOM_NAME is command name only
**Scenario:** `/implement` with no arguments
**Expected ROOM_NAME:** `implement`

**Why:** When ARGUMENTS is empty, ROOM_SLUG is empty. The script takes the
`else` branch and sets `ROOM_NAME="${COMMAND_NAME}"` — no suffix.

**Verification steps:**
1. In a terminal, source the init script with an empty second argument:
   ```bash
   source /home/user/example-project/services/chat-bridge/init-session.sh "implement" ""
   echo "ROOM_NAME=$ROOM_NAME"
   ```
2. Confirm output is: `ROOM_NAME=implement`

**Pass criteria:**
- [ ] `echo $ROOM_NAME` outputs `implement` (no trailing hyphen, no suffix)

---

### Edge case C: Bridge down — command still runs (CHAT_AVAILABLE=false path)
**Scenario:** The bridge is not running and cannot start (dist/bridge.js absent or port blocked).

**Why:** `init-session.sh` exports `CHAT_AVAILABLE=false` and continues — it must never
abort the parent command. The lifecycle POST is guarded by `if [ "$CHAT_AVAILABLE" = true ]`.

**Verification steps:**
1. Stop the bridge if running:
   ```bash
   kill $(cat /tmp/chat-bridge-*.pid 2>/dev/null) 2>/dev/null || true
   ```
2. Temporarily rename the built artifact to simulate absence:
   ```bash
   mv /home/user/example-project/services/chat-bridge/dist/bridge.js \
      /home/user/example-project/services/chat-bridge/dist/bridge.js.bak
   ```
3. Source the init script:
   ```bash
   source /home/user/example-project/services/chat-bridge/init-session.sh "discuss" "test"
   echo "CHAT_AVAILABLE=$CHAT_AVAILABLE"
   echo "ROOM_NAME=$ROOM_NAME"
   ```
4. Confirm:
   - `CHAT_AVAILABLE=false`
   - `ROOM_NAME=discuss-test` (slug still computed — it is set before bridge check)
   - No error exit — the source line returns cleanly
5. Restore the artifact:
   ```bash
   mv /home/user/example-project/services/chat-bridge/dist/bridge.js.bak \
      /home/user/example-project/services/chat-bridge/dist/bridge.js
   ```

**Pass criteria:**
- [ ] `CHAT_AVAILABLE=false` when bridge cannot start
- [ ] Script does not `exit 1` — the sourcing shell continues normally
- [ ] `ROOM_NAME` is still set correctly (slug computation is bridge-independent)
- [ ] No curl errors surface to the user (all curl calls use `|| true`)

---

## 4. Manual Sign-off Checklist

Complete every item before marking Wave 3 done. Record evidence (screenshot or log line) for dashboard items.

### Static checks (can run before any service is started)
- [ ] Run `bash /home/user/example-project/tests/validate-wave3.sh` — output shows `49 passed, 0 failed`
- [ ] Confirm discuss.md line 16 reads:
  `source "$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel 2>/dev/null)/services/chat-bridge/init-session.sh" "discuss" "$*"`
- [ ] Confirm the same pattern (with matching command name) exists in each of:
  research.md, plan.md, implement.md, review.md, ship.md
- [ ] Confirm consult.md source line is unchanged from its pre-Wave-3 form

### Smoke test (requires services running)
- [ ] Dashboard loads at http://127.0.0.1:4001 with no console errors
- [ ] `/discuss "test"` produces a `phase_start` event in the dashboard with data=`discuss`
- [ ] ROOM_NAME in bridge logs matches `discuss-test`
- [ ] Bridge auto-started if it was down before the command ran

### Edge case sign-offs
- [ ] `source init-session.sh "review" "HEAD~3"` → ROOM_NAME is `review-head-3`
- [ ] `source init-session.sh "implement" ""` → ROOM_NAME is `implement`
- [ ] With bridge.js absent, `source init-session.sh "discuss" "test"` → CHAT_AVAILABLE=false, no crash

### Regression (run after any last-minute edits)
- [ ] Re-run `bash /home/user/example-project/tests/validate-wave3.sh` — still 49 passed, 0 failed

---

## Coverage Gaps

| Item | Gap | Reason |
|------|-----|--------|
| ROOM_NAME 100-char truncation | Not automatically tested | Would need a 200-char argument; low risk given `${ROOM_NAME:0:100}` is a bash built-in |
| Bridge port conflict (4002 taken by another process) | Not tested | Requires environment manipulation; not a Wave 3 concern |
| Dashboard WebSocket fan-out to multiple browser tabs | Not tested | agent-chat server responsibility, not Wave 3 scope |
| `/lifecycle` response body `{ok: true}` verification | Not tested | `init-session.sh` discards curl output — response correctness covered by bridge unit tests |

---

## Test Files
- `/home/user/example-project/tests/validate-wave3.sh` — automated regression (49 checks, 7 files)
- `/home/user/example-project/tests/wave3-validation-plan.md` — this document
