---
name: forgeflow-validation-plan
description: Plan focused validation commands from changed files
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Show the focused validation commands implied by the current changed files, plus when full suite and source smoke are required.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-validation-plan.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-validation-plan.js" ]; then
  echo "Validation plan helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-validation-plan."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-validation-plan"; exit 2 ;;
  esac
done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-validation-plan.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output lists focused validation commands.
- [ ] Output makes full-suite and source-smoke requirements explicit.
</success_criteria>
