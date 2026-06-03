---
name: forgeflow-workflow-readiness
description: Show the next safe workflow-readiness action across review waves, calibration, profile, telemetry, and runtime inventory
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Show a read-only queue for the next safe Forgeflow refinements: context-budget review waves, outcome calibration, explicit profile setup, telemetry quality, and runtime inventory parity. Keep high-risk `/review` safe-args work paused.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-workflow-readiness.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-workflow-readiness.js" ]; then
  echo "Workflow readiness helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-workflow-readiness."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-workflow-readiness"; exit 2 ;;
  esac
done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-workflow-readiness.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output gives one ordered next action across the five safe readiness phases.
- [ ] Output lists paused high-risk work separately and does not edit `/review`.
- [ ] Output does not write wave files, record outcomes, infer preferences, change routing, repair installs, commit, push, or call GitHub.
</success_criteria>
