---
name: forgeflow-outcome-capture-plan
description: Show which local outcome evidence streams need the next recorder entry
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Show missing local outcome evidence streams and the recorder commands to use after real review, recommendation, or agent-feedback evidence exists.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-outcome-capture-plan.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-outcome-capture-plan.js" ]; then
  echo "Outcome capture plan helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-outcome-capture-plan."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-outcome-capture-plan"; exit 2 ;;
  esac
done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-outcome-capture-plan.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output shows missing outcome streams and concrete recorder prompts.
- [ ] Output does not write outcome records or infer evidence.
</success_criteria>
