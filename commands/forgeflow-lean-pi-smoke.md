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
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node --test pi-extension/test/*.test.js
```
</process>

<success_criteria>
- [ ] The pi extension tests pass.
- [ ] The command does not install adapters, edit settings, commit, push, or call the network.
</success_criteria>
