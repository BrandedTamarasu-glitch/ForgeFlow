---
name: forgeflow-learning-capture-nudge
description: Show the exact local capture command to run after a review, next-work action, agent feedback, or first-run trial
argument-hint: "[--event review|next-work|agent-feedback|first-run] [--json]"
allowed-tools:
  - Bash
---
<objective>
Nudge the user to capture observed workflow outcomes with the right Forgeflow learning command without inventing evidence.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--event review|next-work|agent-feedback|first-run` and `--json`.

```bash
HELPER_DIR="scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/render-learning-capture-nudge.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -f "${HELPER_DIR}/render-learning-capture-nudge.js" ]; then
  echo "Learning capture nudge helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-learning-capture-nudge."
  exit 1
fi
SAFE_ARGS=()
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
i=0
while [ "$i" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$i]}"
  case "$arg" in
    --event)
      next_index=$((i + 1))
      event="${USER_ARGS[$next_index]:-}"
      case "$event" in
        review|next-work|agent-feedback|first-run) SAFE_ARGS+=(--event "$event") ;;
        *) echo "Invalid --event for /forgeflow-learning-capture-nudge"; exit 2 ;;
      esac
      i=$next_index
      ;;
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-learning-capture-nudge"; exit 2 ;;
  esac
  i=$((i + 1))
done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-learning-capture-nudge.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is read-only.
- [ ] Output gives one capture command and a stop rule.
- [ ] First-run capture makes observed placeholder values explicit.
</success_criteria>
