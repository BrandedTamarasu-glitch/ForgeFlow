---
name: forgeflow-lean-adapter-drift
description: Check committed lean adapter instruction copies for drift
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Compare committed lean adapter instruction copies with canonical generated lean rules and required safety invariants.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments or `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-adapter-drift.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-adapter-drift.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-adapter-drift.js" ]; then
  echo "Lean adapter drift helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-adapter-drift."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "") ;;
    --json) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-lean-adapter-drift"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-adapter-drift.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output reports committed adapter copy drift status.
- [ ] The command does not rewrite files, install adapters, commit, push, or call the network.
</success_criteria>
