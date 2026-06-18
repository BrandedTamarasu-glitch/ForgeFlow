---
name: forgeflow-lean-pi-smoke
description: Run the pi extension focused smoke test
argument-hint: ""
allowed-tools:
  - Bash
---
<objective>
Run the committed pi extension tests for Forgeflow lean mode command registration and prompt injection.
</objective>

<process>
This command accepts no arguments.

```bash
if [ -n "${ARGUMENTS:-}" ]; then
  echo "Unsupported arguments for /forgeflow-lean-pi-smoke"
  exit 2
fi
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER="${ROOT}/scripts/forgeflow/run-lean-pi-smoke.js"
if [ ! -x "${HELPER}" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/run-lean-pi-smoke.js" ]; then
  HELPER="$HOME/.claude/forgeflow/scripts/forgeflow/run-lean-pi-smoke.js"
fi
if [ ! -x "${HELPER}" ]; then
  echo "Lean pi smoke helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-pi-smoke."
  exit 1
fi
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER}"
```
</process>

<success_criteria>
- [ ] The pi extension tests pass.
- [ ] The command does not install adapters, edit settings, commit, push, or call the network.
</success_criteria>
