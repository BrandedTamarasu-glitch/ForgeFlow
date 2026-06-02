---
name: forgeflow-next-action-audit
description: Check Forgeflow helper next actions for copy-pastable command-only output
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Run a read-only audit over representative helper outputs that keeps `next`, `next_action`, and `next_command` values copy-pastable. Explanatory prose belongs in `next_reason`.
</objective>

<process>
Validate `$ARGUMENTS`. Only `--json` is supported.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/next-action-contract.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/next-action-contract.js" ]; then
  echo "Next action audit helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-next-action-audit."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-next-action-audit"; exit 2 ;;
  esac
done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/next-action-contract.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is read-only.
- [ ] Any non-copy-pastable next action from the sampled helpers is reported with the source path.
- [ ] Prose is directed to `next_reason`, not mixed into `next`.
</success_criteria>
