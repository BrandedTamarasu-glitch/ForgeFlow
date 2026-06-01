---
name: forgeflow-telemetry-quality
description: Summarize whether local Forgeflow telemetry and outcome evidence are strong enough for calibration
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Show whether the project has enough review outcomes, agent feedback, next-work outcomes, and local workflow metrics to support learning-based routing and recommendations.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-telemetry-quality.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-telemetry-quality.js" ]; then
  echo "Telemetry quality helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-telemetry-quality."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-telemetry-quality"; exit 2 ;;
  esac
done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-telemetry-quality.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is read-only and does not export or infer private telemetry.
- [ ] Missing evidence streams are named plainly.
- [ ] Counts are local and advisory, not presented as CI or reviewer approval.
</success_criteria>
