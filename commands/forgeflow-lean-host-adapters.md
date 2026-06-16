---
name: forgeflow-lean-host-adapters
description: Validate committed Forgeflow lean host adapter artifacts
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Validate committed Forgeflow lean adapter/plugin files across supported hosts without installing adapters or editing host settings.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments or `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-host-adapters.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-host-adapters.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-host-adapters.js" ]; then
  echo "Lean host adapter helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-host-adapters."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "") ;;
    --json) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-lean-host-adapters"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-host-adapters.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output reports committed host adapter status.
- [ ] The command does not install adapters, edit settings, commit, push, or call the network.
</success_criteria>
