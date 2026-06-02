---
name: forgeflow-wrapper-drift-plan
description: Group command wrapper drift into safe mechanical, manual, and high-risk follow-up buckets
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Show a read-only plan for remaining Forgeflow command-wrapper drift, separating safe mechanical cleanup from high-risk argument plumbing.
</objective>

<process>
Validate `$ARGUMENTS`. Only `--json` is supported.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/render-wrapper-drift-plan.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -f "${HELPER_DIR}/render-wrapper-drift-plan.js" ]; then
  echo "Wrapper drift planner is not installed. Run /update-forgeflow --repair, then retry /forgeflow-wrapper-drift-plan."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-wrapper-drift-plan"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-wrapper-drift-plan.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is read-only.
- [ ] Safe mechanical work is separated from high-risk wrapper work.
- [ ] Validation commands are listed.
</success_criteria>
