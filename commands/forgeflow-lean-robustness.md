---
name: forgeflow-lean-robustness
description: Run deterministic lean robustness selftests for shortcut correctness traps
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Run deterministic known-good versus known-lazy-wrong checks for common correctness traps. This is a local selftest for lean robustness graders and does not call models or run generated code.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-robustness-eval.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-robustness-eval.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-robustness-eval.js" ]; then
  echo "Lean robustness helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-robustness."
  exit 1
fi
SAFE_ARGS=()
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "" ) ;;
    --json) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-lean-robustness"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-robustness-eval.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output reports known-good accepted and known-lazy-wrong rejected for every case.
- [ ] The command does not call models, run generated code, install dependencies, commit, push, or call the network.
</success_criteria>
