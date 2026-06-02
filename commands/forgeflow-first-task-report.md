---
name: forgeflow-first-task-report
description: Summarize first real work-item success, blockers, and next adoption action
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Show a local first-task success report using useful-win evidence, learning status, next-work outcomes, and review outcomes.
</objective>

<process>
Validate `$ARGUMENTS`. Only `--json` is supported.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/render-first-task-report.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -f "${HELPER_DIR}/render-first-task-report.js" ]; then
  echo "First task report helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-first-task-report."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-first-task-report"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-first-task-report.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is local and advisory.
- [ ] Output summarizes success signals, blockers, evidence, next command, and reason.
- [ ] Raw project records are not printed.
</success_criteria>
