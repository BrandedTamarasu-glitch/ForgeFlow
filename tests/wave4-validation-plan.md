# Wave 4 — Manual Validation Plan

Static checks cover structure and presence of code changes. This plan covers runtime
behaviours that cannot be verified by grep.

## Prerequisites

Both servers must be running before executing any of these checks:

```
# Build bridge first (required after any source change)
cd /home/user/example-project/services/chat-bridge && npm run build

node /home/user/example-project/services/agent-chat/server.js &
node /home/user/example-project/services/chat-bridge/dist/bridge.js &
```

Dashboard URL: http://127.0.0.1:4001

---

## 1. Fix 4 — Room name with special characters (double-escape regression)

**What was fixed:** The `/join` handler in server.js was calling
`broadcastLifecycle('room-changed', { room: escapeHtml(room) })`, causing the room name
to be HTML-escaped twice. `&` would arrive at the browser as `&amp;amp;`.

**Test steps:**

- [ ] With a bridge client connected, POST to the bridge:
  ```
  curl -s -X POST http://127.0.0.1:4002/room \
    -H 'Content-Type: application/json' \
    -d '{"name": "test-room"}'
  ```
  Note: the room name regex `[a-z0-9-]{1,100}` does not allow `&`, so the room field
  itself cannot carry the character. The double-escape risk is in the `broadcastLifecycle`
  extra object.

- [ ] To exercise the escapeHtml path directly, open the dashboard WebSocket in a browser
  devtools console and observe the `room-changed` lifecycle event payload when a `/join`
  command fires. Confirm `room` value is the raw room name string, not HTML-entity encoded.

- [ ] **Simplified proxy check:** Temporarily rename a room to include a name with a
  hyphen (e.g. `my-room`) and confirm the dashboard `#phase-name` element shows `my-room`
  — not `my-room` double-encoded in any way.

**Pass criteria:** The `room` field in the `room-changed` lifecycle payload sent to
dashboard clients equals the raw room name. No `&amp;`, `&lt;`, or similar entities
appear in the displayed room name for names composed of valid characters.

---

## 2. Fix 9a — POST /lifecycle with oversized `event` field → HTTP 400

**What was fixed:** bridge.ts `/lifecycle` handler now rejects `event` strings longer
than 500 characters with a 400 response.

**Test steps:**

- [ ] Generate a 501-character string and POST to `/lifecycle`:
  ```
  EVENT=$(python3 -c "print('x' * 501)")
  curl -s -o - -w "\nHTTP %{http_code}\n" \
    -X POST http://127.0.0.1:4002/lifecycle \
    -H 'Content-Type: application/json' \
    -d "{\"event\": \"${EVENT}\"}"
  ```

- [ ] Confirm the response is HTTP 400 with body:
  ```json
  { "ok": false, "error": "event must be 500 characters or fewer" }
  ```

- [ ] Confirm a 500-character event is accepted (HTTP 200):
  ```
  EVENT=$(python3 -c "print('x' * 500)")
  curl -s -o - -w "\nHTTP %{http_code}\n" \
    -X POST http://127.0.0.1:4002/lifecycle \
    -H 'Content-Type: application/json' \
    -d "{\"event\": \"${EVENT}\"}"
  ```

**Pass criteria:** 501 chars → 400 with correct error message. 500 chars → 200.

---

## 3. Fix 9b — POST /lifecycle with oversized `data` field → HTTP 400

**What was fixed:** Same handler rejects `data` strings longer than 2000 characters.

**Test steps:**

- [ ] POST with a 2001-character `data` value:
  ```
  DATA=$(python3 -c "print('x' * 2001)")
  curl -s -o - -w "\nHTTP %{http_code}\n" \
    -X POST http://127.0.0.1:4002/lifecycle \
    -H 'Content-Type: application/json' \
    -d "{\"event\": \"test\", \"data\": \"${DATA}\"}"
  ```

- [ ] Confirm HTTP 400 with body:
  ```json
  { "ok": false, "error": "data must be 2000 characters or fewer" }
  ```

- [ ] Confirm a 2000-character `data` field is accepted (HTTP 200):
  ```
  DATA=$(python3 -c "print('x' * 2000)")
  curl -s -o - -w "\nHTTP %{http_code}\n" \
    -X POST http://127.0.0.1:4002/lifecycle \
    -H 'Content-Type: application/json' \
    -d "{\"event\": \"test\", \"data\": \"${DATA}\"}"
  ```

**Pass criteria:** 2001-char data → 400 with correct error. 2000-char data → 200.

---

## 4. Fix 2a — #new-pill renders without UA button defaults (Firefox + Chrome)

**What was fixed:** `#new-pill` was converted from a `<div role="button">` to a native
`<button>`. User-agent stylesheets apply default button styling (background, border,
padding, font). The fix adds `font: inherit` and `appearance: none` to suppress these.

**Test steps (repeat in both Firefox and Chrome):**

- [ ] Open http://127.0.0.1:4001 in Firefox.
- [ ] Trigger enough messages that `#new-pill` becomes visible (scroll away from bottom,
  then have an agent send a message via the bridge `/send` endpoint).
- [ ] Visually inspect `#new-pill`:
  - Background should be the dark pill blue (`#1f2937`), not a grey UA default.
  - Border should be `1px solid #1d4ed8`, not a raised/inset UA border.
  - Font should match the rest of the dashboard (monospace, 11px).
  - No visible UA button chrome around the element.
- [ ] Repeat in Chrome.

**Pass criteria:** The pill looks identical in Firefox and Chrome, and matches the
dark-themed design. No grey box, no raised border, no font change compared to surrounding text.

---

## 5. Fix 2b — Tab to #new-pill shows focus ring

**What was fixed:** Native `<button>` elements are tab-focusable by default. The
`:focus-visible` rule provides an explicit focus ring (`outline: 2px solid #58a6ff`).

**Test steps:**

- [ ] Open http://127.0.0.1:4001 in Chrome or Firefox.
- [ ] Trigger `#new-pill` to become visible (same as test 4 above).
- [ ] Use keyboard Tab to cycle focus through the page until `#new-pill` receives focus.
- [ ] Confirm a visible blue focus ring (approximately `2px solid #58a6ff`) appears
  around the pill.
- [ ] Press Enter or Space — confirm the page scrolls to the bottom and the pill hides.
- [ ] Confirm that clicking with a mouse does NOT show the focus ring (`:focus-visible`
  suppresses it for pointer interactions in modern browsers).

**Pass criteria:** Tab focus shows a clear blue ring. Mouse click does not show a ring.
Keyboard activation (Enter/Space) scrolls to bottom and hides the pill.

---

## 6. Fix 3 — Room switch scrolls chat to bottom

**What was fixed:** The `room-changed` lifecycle event handler in index.html now calls
both `afterAppend()` and `scrollToBottom()`. Previously only `scrollToBottom()` was
called, meaning the scroll state was not reset properly in all cases.

**Test steps:**

- [ ] Open the dashboard in a browser and allow several messages to accumulate.
- [ ] Scroll up so you are NOT at the bottom. Verify `#new-pill` is visible with a count.
- [ ] Trigger a room change via the bridge:
  ```
  curl -s -X POST http://127.0.0.1:4002/room \
    -H 'Content-Type: application/json' \
    -d '{"name": "new-room"}'
  ```
- [ ] Confirm:
  - The chat pane scrolls to the bottom immediately after the room change.
  - `#new-pill` disappears (the `afterAppend()` call resets `autoScroll = true` and
    hides the pill when already at bottom — but more precisely, `scrollToBottom()` brings
    us to the bottom, and subsequent messages will auto-scroll correctly).
  - The `#phase-name` element in the header updates to `new-room`.
- [ ] Send a new message after the room change and confirm it auto-scrolls (the
  `autoScroll` state is now true, so the next `afterAppend()` should scroll).

**Pass criteria:** After a room switch, the view is at the bottom, the pill is hidden,
and subsequent messages continue to auto-scroll.

---

## Pressure Tests

### P1 — Boundary value at exactly 500 chars for event

- **Setup:** Bridge running, bridge HTTP accessible.
- **Action:** POST `/lifecycle` with event = string of exactly 500 `a` characters.
- **Expected:** HTTP 200, `{ ok: true }`.
- **Pass/Fail:** Any non-200 response is a failure — the cap is `> 500`, so 500 must pass.

### P2 — Boundary value at exactly 2000 chars for data

- **Setup:** Same.
- **Action:** POST `/lifecycle` with valid event and data = string of exactly 2000 `a` characters.
- **Expected:** HTTP 200, `{ ok: true }`.
- **Pass/Fail:** Any non-200 response is a failure — the cap is `> 2000`, so 2000 must pass.

### P3 — Rapid room switches

- **Setup:** Dashboard open in browser, bridge running.
- **Action:** Issue 10 room switch POSTs in rapid succession (100ms apart):
  ```
  for i in $(seq 1 10); do
    curl -s -X POST http://127.0.0.1:4002/room \
      -H 'Content-Type: application/json' \
      -d "{\"name\": \"room-${i}\"}" &
  done
  wait
  ```
- **Expected:** Dashboard ends up showing one of the room names (last-write-wins is
  acceptable). No crash, no blank room name, no JS error in the console.
- **Pass/Fail:** Dashboard remains functional and shows a valid room name.

### P4 — #new-pill keyboard trap check

- **Setup:** Dashboard open, pill visible.
- **Action:** Tab to `#new-pill`, then Shift+Tab back to check reverse navigation.
- **Expected:** Focus moves naturally forward and backward. No keyboard trap.
- **Pass/Fail:** Focus leaves `#new-pill` cleanly in both directions.

### P5 — Oversized event and valid data in same request

- **Setup:** Bridge running.
- **Action:** POST `/lifecycle` with event = 501 chars AND data = 100 chars.
- **Expected:** HTTP 400 with error `"event must be 500 characters or fewer"`.
  The event cap check fires before the data cap check.
- **Pass/Fail:** Correct 400 with the event-specific error message.
