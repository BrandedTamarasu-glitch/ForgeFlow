---
name: forgeflow-lean-hook-contract
description: Run the Forgeflow lean activation hook subprocess contract
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Exercise the lean activation hook in a temporary state directory when local process spawning is available. Sandbox process denial is reported explicitly as an environment-blocked warning.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-hook-contract.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-hook-contract.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-hook-contract.js" ]; then
  echo "Lean hook contract helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-hook-contract."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "" ) ;;
    --json) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-lean-hook-contract"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-hook-contract.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output reports pass/warn/fail for subprocess hook checks.
- [ ] The command does not edit settings, install hooks, commit, push, or call the network.
</success_criteria>
