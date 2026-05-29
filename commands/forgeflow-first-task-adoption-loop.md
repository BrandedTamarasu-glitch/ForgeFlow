---
name: forgeflow-first-task-adoption-loop
description: Decide whether a first Forgeflow task should repeat, fix, defer, or expand
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Turn first-task and first-useful-win evidence into an adoption-loop decision: repeat, fix, defer, or expand.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-first-task-adoption-loop.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-first-task-adoption-loop.js" ]; then
  echo "First-task adoption loop helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-first-task-adoption-loop."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-first-task-adoption-loop"; exit 2 ;;
  esac
done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-first-task-adoption-loop.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output gives a concrete repeat, fix, defer, or expand decision.
- [ ] Output summarizes counts only and does not expose raw local project records.
</success_criteria>
