---
name: forgeflow-workflow-ending-capture
description: Recommend the outcome recorder command to run at the end of a Forgeflow workflow
argument-hint: "[--event review|next-work|agent-feedback|auto] [--json]"
allowed-tools:
  - Bash
---
<objective>
Show the one explicit outcome-capture prompt that should be considered after a review, next-work action, or agent-feedback event.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--event review|next-work|agent-feedback|auto` and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-workflow-ending-capture.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-workflow-ending-capture.js" ]; then
  echo "Workflow-ending capture helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-workflow-ending-capture."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
i=0
while [ "$i" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$i]}"
  case "$arg" in
    --event)
      i=$((i + 1))
      value="${USER_ARGS[$i]:-}"
      case "$value" in
        review|next-work|agent-feedback|auto) SAFE_ARGS+=(--event "$value") ;;
        *) echo "Unsupported arguments for /forgeflow-workflow-ending-capture"; exit 2 ;;
      esac
      ;;
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-workflow-ending-capture"; exit 2 ;;
  esac
  i=$((i + 1))
done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-workflow-ending-capture.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is read-only and never records evidence by itself.
- [ ] Event-specific output points to the matching recorder command when evidence is missing.
- [ ] Output explains when no capture is currently required.
</success_criteria>
