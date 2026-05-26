---
name: forgeflow-repair
description: Show a non-mutating guided repair plan for Forgeflow install, health, smoke, and manual settings issues
argument-hint: "[--json]"
allowed-tools:
  - Bash
---

Run a guided repair plan. This command does not mutate files and never edits `settings.json`.

```bash
HELPER_DIR="scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-guided-repair.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-guided-repair.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi

if [ ! -x "${HELPER_DIR}/render-guided-repair.js" ]; then
  echo "Guided repair helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-repair."
  exit 1
fi

if printf '%s\n' "$ARGUMENTS" | grep -Eq '(^|[[:space:]])--json([[:space:]]|$)'; then
  node "${HELPER_DIR}/render-guided-repair.js" --json
else
  node "${HELPER_DIR}/render-guided-repair.js"
fi
```
