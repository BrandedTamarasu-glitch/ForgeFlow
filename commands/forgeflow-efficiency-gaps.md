---
name: forgeflow-efficiency-gaps
description: Plan the largest Forgeflow gaps for token reduction, calibration, telemetry, and workflow efficiency
argument-hint: "[--failed-command <cmd>] [--json]"
allowed-tools:
  - Bash
---
<objective>
Automate local discovery of the largest current Forgeflow efficiency gaps and print a phased safe-buildout plan using project intelligence, learning status, outcome capture readiness, failure-digest readiness, runtime inventory pressure, and telemetry sparsity.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--json` and an optional `--failed-command <cmd>` preview.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-efficiency-gap-plan.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-efficiency-gap-plan.js" ]; then
  echo "Efficiency gap planner helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-efficiency-gaps."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
if [ -n "${ARGUMENTS:-}" ]; then
  SAFE_ARGS+=(--args "${ARGUMENTS}")
fi
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-efficiency-gap-plan.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output lists five ranked phases selected from current evidence, with evidence, safe slices, validation commands, and high-risk boundaries.
- [ ] Output automates gap discovery and next-command surfacing, while mutating actions remain explicit through existing recorder, profile, repair, update, or capture commands.
</success_criteria>
