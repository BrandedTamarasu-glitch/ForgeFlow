---
name: forgeflow-stale-artifact-plan
description: Show the minimal refresh plan for stale local guidance artifacts
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Identify stale local code-map, latest-insights, failure-digest, and context-budget artifacts, then show minimal refresh commands.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-stale-artifact-plan.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-stale-artifact-plan.js" ]; then
  echo "Stale artifact plan helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-stale-artifact-plan."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-stale-artifact-plan"; exit 2 ;;
  esac
done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-stale-artifact-plan.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output lists stale artifact issues and minimal refresh commands.
- [ ] Output is read-only and does not refresh or delete artifacts.
</success_criteria>
