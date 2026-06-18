---
name: forgeflow-command-capability
description: Render a read-only matrix of Forgeflow command coverage across host surfaces
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Show which Forgeflow commands are available as command wrappers, Pi aliases, OpenCode commands, and skills.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments or `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-command-capability-matrix.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-command-capability-matrix.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-command-capability-matrix.js" ]; then
  echo "Command capability helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-command-capability."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "") ;;
    --json) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-command-capability"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-command-capability-matrix.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output includes Forgeflow, Pi, OpenCode, and skill availability for commands.
- [ ] The command is read-only and does not install adapters, edit settings, commit, push, or call the network.
</success_criteria>
