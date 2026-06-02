---
name: forgeflow-learning-action
description: Route weak Forgeflow learning signals to the next local capture or check command
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Turn the weakest current Forgeflow learning and telemetry signals into one concrete next action.
</objective>

<context>
This command is local and read-only. It does not record new learnings, approve work, call the network, commit, push, or export local evidence.
</context>

<process>
Validate `$ARGUMENTS`. Only `--json` is supported.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/render-learning-action-router.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -f "${HELPER_DIR}/render-learning-action-router.js" ]; then
  echo "Learning action helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-learning-action."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-learning-action"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-learning-action-router.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output names the weakest learning or telemetry source.
- [ ] Output includes one concrete next command.
- [ ] Output states the local read-only boundary.
</success_criteria>
