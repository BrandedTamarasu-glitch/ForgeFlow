---
name: forgeflow-lean-windows-smoke
description: Run lean Windows path/statusline compatibility checks
argument-hint: ""
allowed-tools:
  - Bash
---
<objective>
Run local compatibility checks for lean hook state paths and statusline lean badges with Windows-style environment variables present.
</objective>

<process>
This command accepts no arguments.

```bash
if [ -n "${ARGUMENTS:-}" ]; then
  echo "Unsupported arguments for /forgeflow-lean-windows-smoke"
  exit 2
fi
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node scripts/forgeflow/test-lean-windows-compat.js
```
</process>

<success_criteria>
- [ ] The Windows compatibility check passes.
- [ ] The command does not install adapters, edit settings, commit, push, or call the network.
</success_criteria>
