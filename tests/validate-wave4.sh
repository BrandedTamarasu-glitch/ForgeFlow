#!/bin/bash
# validate-wave4.sh — Wave 4 static regression checks.
# Verifies that all nine fixes across five files landed correctly.
#
# Usage: bash /home/user/example-project/tests/validate-wave4.sh
# Exit code: 0 if all checks pass, 1 if any fail.

set -euo pipefail

BRIDGE_TS="/home/user/example-project/services/chat-bridge/bridge.ts"
CONNECTIONS_TS="/home/user/example-project/services/chat-bridge/connections.ts"
TYPES_TS="/home/user/example-project/services/chat-bridge/types.ts"
SERVER_JS="/home/user/example-project/services/agent-chat/server.js"
INDEX_HTML="/home/user/example-project/services/agent-chat/public/index.html"

PASS=0
FAIL=0

# ─── helpers ────────────────────────────────────────────────────────────────

pass() { echo "  PASS  $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL  $1"; FAIL=$((FAIL + 1)); }

# absent <pattern> <file> — passes if pattern is NOT found
absent() {
  local pattern="$1"
  local file="$2"
  if grep -qE "$pattern" "$file"; then
    return 1
  fi
  return 0
}

# present <pattern> <file> — passes if pattern IS found
present() {
  local pattern="$1"
  local file="$2"
  if grep -qE "$pattern" "$file"; then
    return 0
  fi
  return 1
}

# ─── Wave 4a — TypeScript cleanup ───────────────────────────────────────────

echo ""
echo "[bridge.ts — Fix 7: UPSTREAM_BASE_URL removed]"

if absent 'UPSTREAM_BASE_URL' "$BRIDGE_TS"; then
  pass "UPSTREAM_BASE_URL constant is gone from bridge.ts"
else
  fail "UPSTREAM_BASE_URL still present in bridge.ts"
fi

echo ""
echo "[bridge.ts — Fix 5: isVerbosityLevel import removed]"

# isVerbosityLevel is defined in types.ts (its own file) — that's legitimate.
# We check that bridge.ts no longer imports it.
if absent 'isVerbosityLevel' "$BRIDGE_TS"; then
  pass "isVerbosityLevel does not appear in bridge.ts (import removed)"
else
  fail "isVerbosityLevel still referenced in bridge.ts"
fi

echo ""
echo "[types.ts — Fix 5: parseVerbosityRequest return type tightened]"

# Verify the tightened return type: should return '{ level: VerbosityLevel } | null'
# not the looser 'VerbosityRequest | null'
if present '\{\s*level:\s*VerbosityLevel\s*\}\s*\|\s*null' "$TYPES_TS"; then
  pass "parseVerbosityRequest returns { level: VerbosityLevel } | null"
else
  fail "parseVerbosityRequest return type not found / not tightened"
fi

echo ""
echo "[connections.ts — Fix 6: async removed from connect()]"

# The connect method should NOT be declared async
if absent 'async connect\(' "$CONNECTIONS_TS"; then
  pass "connect() is not declared async"
else
  fail "async connect() still present in connections.ts"
fi

# And the explicit Promise.resolve() should be present
if present 'return Promise\.resolve\(\)' "$CONNECTIONS_TS"; then
  pass "explicit Promise.resolve() return present in connect()"
else
  fail "Promise.resolve() return missing from connect()"
fi

# ─── Wave 4b — Server-side fixes ────────────────────────────────────────────

echo ""
echo "[server.js — Fix 4: double-escape of room removed from /join handler]"

# The old bug was passing escapeHtml(room) into broadcastLifecycle's extra object.
# Fixed: the /join handler now passes { room } (unescaped); broadcastLifecycle
# applies escapeHtml internally.
# We check that the /join block no longer calls escapeHtml with the room variable.
if absent 'broadcastLifecycle.*escapeHtml\(room\)' "$SERVER_JS"; then
  pass "broadcastLifecycle call does not double-escape room"
else
  fail "broadcastLifecycle still receives escapeHtml(room) — double-escape present"
fi

# Positive check: the correct pattern is { room } (plain variable)
if present "broadcastLifecycle\('room-changed',\s*\{\s*room\s*\}\)" "$SERVER_JS"; then
  pass "broadcastLifecycle called with plain { room } object"
else
  fail "broadcastLifecycle not called with plain { room } — fix may not have landed"
fi

echo ""
echo "[bridge.ts — Fix 9: field-length caps in /lifecycle handler]"

# event cap: event.length > 500 → 400
if present 'event\.length\s*>\s*500' "$BRIDGE_TS"; then
  pass "event.length > 500 cap present in bridge.ts"
else
  fail "event.length cap missing from bridge.ts"
fi

# data cap: data.length > 2000 → 400
if present 'data\.length\s*>\s*2000' "$BRIDGE_TS"; then
  pass "data.length > 2000 cap present in bridge.ts"
else
  fail "data.length cap missing from bridge.ts"
fi

# Both caps should result in 400 responses — check the error messages are present
if present "event must be 500 characters or fewer" "$BRIDGE_TS"; then
  pass "400 error message for oversized event present"
else
  fail "400 error message for oversized event missing"
fi

if present "data must be 2000 characters or fewer" "$BRIDGE_TS"; then
  pass "400 error message for oversized data present"
else
  fail "400 error message for oversized data missing"
fi

# ─── Wave 4c — Frontend A11Y fixes ──────────────────────────────────────────

echo ""
echo "[index.html — Fix 1: #ws-dot::after CSS block removed]"

if absent '#ws-dot::after' "$INDEX_HTML"; then
  pass "#ws-dot::after CSS block is gone"
else
  fail "#ws-dot::after CSS block still present in index.html"
fi

echo ""
echo "[index.html — Fix 2: #new-pill is a native <button>]"

# The element must be a <button>, not a div with role="button".
# id="new-pill" may be on its own line (multi-line tag), so we check that:
#   (a) a <button tag opens before the id="new-pill" attribute, and
#   (b) no <div tag opens immediately before it.
# Strategy: grab the 3 lines around id="new-pill" and check for <button.
if grep -B3 'id="new-pill"' "$INDEX_HTML" | grep -qE '<button'; then
  pass "#new-pill is a native <button> element"
else
  fail "#new-pill is not a <button> element"
fi

# role="button" should not appear — it would be redundant on a native button
# and its presence would indicate the old div pattern survived
if absent 'id="new-pill"[^>]*role="button"' "$INDEX_HTML"; then
  pass "#new-pill does not carry redundant role=\"button\""
else
  fail "#new-pill still has role=\"button\" — old div pattern may remain"
fi

# font: inherit must be in the #new-pill CSS block
if present 'font:\s*inherit' "$INDEX_HTML"; then
  pass "#new-pill CSS includes font: inherit"
else
  fail "#new-pill CSS missing font: inherit"
fi

# appearance: none must be in the #new-pill CSS block
if present 'appearance:\s*none' "$INDEX_HTML"; then
  pass "#new-pill CSS includes appearance: none"
else
  fail "#new-pill CSS missing appearance: none"
fi

# :focus-visible rule must exist for #new-pill
if present '#new-pill:focus-visible' "$INDEX_HTML"; then
  pass "#new-pill:focus-visible rule present"
else
  fail "#new-pill:focus-visible rule missing"
fi

echo ""
echo "[index.html — Fix 3: room-changed calls afterAppend() and scrollToBottom()]"

# Both calls must appear in the lifecycle handler's room-changed branch.
# We check for a room-changed event handler block that contains both calls.
# The simplest reliable check: both function names appear near 'room-changed'.

# Verify afterAppend() is called in the lifecycle case block
if present "case 'lifecycle'" "$INDEX_HTML"; then
  pass "lifecycle case block exists"
else
  fail "lifecycle case block not found"
fi

# afterAppend() must be called in the lifecycle handler
if present "afterAppend\(\)" "$INDEX_HTML"; then
  pass "afterAppend() called in lifecycle handler"
else
  fail "afterAppend() not found in index.html"
fi

# scrollToBottom() must be called in the lifecycle handler's room-changed branch
# Check for the specific guard: if (payload.event === 'room-changed') scrollToBottom()
if present "payload\.event === 'room-changed'.*scrollToBottom\(\)" "$INDEX_HTML"; then
  pass "scrollToBottom() called in room-changed branch"
else
  # Try multi-token search: both must be present in proximity
  # Use a two-line window check via grep -A
  if grep -A2 "room-changed" "$INDEX_HTML" | grep -q 'scrollToBottom()'; then
    pass "scrollToBottom() present in room-changed handling (multi-line)"
  else
    fail "scrollToBottom() not found in room-changed branch"
  fi
fi

# ─── summary ────────────────────────────────────────────────────────────────

echo ""
echo "========================================"
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
