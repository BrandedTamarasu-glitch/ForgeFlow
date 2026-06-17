---
name: forgeflow-lean-host-command-parity
description: Check lean command parity across command-capable host adapters
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Validate that the lean commands registered by host runtime adapters also have matching committed command files for command-capable hosts.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments or `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-host-command-parity.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-host-command-parity.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-host-command-parity.js" ]; then
  echo "Lean host command parity helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-host-command-parity."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "") ;;
    --json) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-lean-host-command-parity"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-host-command-parity.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output reports command parity across pi, Forgeflow command wrappers, and OpenCode command files.
- [ ] The command does not install adapters, edit settings, commit, push, or call the network.
</success_criteria>
