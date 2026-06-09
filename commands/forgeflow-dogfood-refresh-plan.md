---
name: forgeflow-dogfood-refresh-plan
description: Render the ordered local refresh commands needed before rerunning the dogfood report
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Render a read-only refresh plan for dogfood evidence. The plan turns missing or invalid `/forgeflow-dogfood-report` evidence into ordered local commands without running them.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments or `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-dogfood-refresh-plan.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-dogfood-refresh-plan.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-dogfood-refresh-plan.js" ]; then
  echo "Dogfood refresh plan helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-dogfood-refresh-plan."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "") ;;
    --json) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-dogfood-refresh-plan"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-dogfood-refresh-plan.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output lists ordered local refresh commands for missing dogfood evidence.
- [ ] Output names invalid artifacts when evidence cannot be read safely.
- [ ] Default behavior is read-only.
- [ ] The command does not run refresh commands, write artifacts, spawn agents, edit files, commit, push, call GitHub, or promote automation.
</success_criteria>
