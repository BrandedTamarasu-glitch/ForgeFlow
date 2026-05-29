---
name: forgeflow-review-evidence-schema
description: Validate review findings JSON before auto-classification or evidence rendering
argument-hint: "--findings <json> [--json]"
allowed-tools:
  - Bash
---
<objective>
Check that review findings have enough structured evidence for `/forgeflow-review-auto-classify` and `/forgeflow-review-auto-evidence`.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--findings <json>` and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/check-review-evidence-schema.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/check-review-evidence-schema.js" ]; then
  echo "Review evidence schema helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-review-evidence-schema."
  exit 1
fi
SAFE_ARGS=()
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
idx=0
while [ "${idx}" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$idx]}"
  case "$arg" in
    --findings)
      idx=$((idx + 1))
      value="${USER_ARGS[$idx]:-}"
      if [ -z "${value}" ]; then echo "Missing value for --findings"; exit 2; fi
      SAFE_ARGS+=(--findings "${value}")
      ;;
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-review-evidence-schema"; exit 2 ;;
  esac
  idx=$((idx + 1))
done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/check-review-evidence-schema.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output reports pass or attention with concrete schema issues.
- [ ] The helper is read-only and does not classify, edit, commit, or push.
</success_criteria>
