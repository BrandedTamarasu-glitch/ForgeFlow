---
name: forgeflow-release-readiness
description: Run advisory local release readiness checks and show blockers without tagging, pushing, publishing, or calling GitHub.
argument-hint: "[--plan-only] [--json]"
allowed-tools:
  - Bash
---

Run the local release readiness helper. This command is advisory and non-mutating.

```bash
HELPER_DIR="scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/render-release-readiness.js" ] && [ -f "$HOME/.claude/forgeflow/scripts/forgeflow/render-release-readiness.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi

if [ ! -f "${HELPER_DIR}/render-release-readiness.js" ]; then
  echo "Release readiness helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-release-readiness."
  exit 1
fi

if printf '%s\n' "$ARGUMENTS" | grep -Eq '(^|[[:space:]])--json([[:space:]]|$)' && printf '%s\n' "$ARGUMENTS" | grep -Eq '(^|[[:space:]])--plan-only([[:space:]]|$)'; then
  env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-release-readiness.js" --plan-only --json
elif printf '%s\n' "$ARGUMENTS" | grep -Eq '(^|[[:space:]])--json([[:space:]]|$)'; then
  env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-release-readiness.js" --json
elif printf '%s\n' "$ARGUMENTS" | grep -Eq '(^|[[:space:]])--plan-only([[:space:]]|$)'; then
  env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-release-readiness.js" --plan-only
else
  env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-release-readiness.js"
fi
```
