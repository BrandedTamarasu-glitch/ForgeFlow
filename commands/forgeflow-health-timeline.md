---
name: forgeflow-health-timeline
description: Show a compact local timeline of project health, learning, and context signals
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Show a read-only project health timeline from local Forgeflow artifacts, including code-map history, context-advisor history, latest-insights readiness, learning-signal quality, comparable deltas, and project-map evolution.
</objective>

<context>
This command is local and advisory. It does not refresh artifacts, approve work, call the network, or mutate project files.
</context>

<process>
Validate `$ARGUMENTS`. Only `--json` is supported.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/show-project-health-timeline.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -f "${HELPER_DIR}/show-project-health-timeline.js" ]; then
  echo "Project health timeline helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-health-timeline."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-health-timeline"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/show-project-health-timeline.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output includes project-local timeline events and project-map evolution.
- [ ] Output states the timeline is advisory and read-only.
- [ ] Missing artifacts produce an actionable refresh next step.
</success_criteria>
