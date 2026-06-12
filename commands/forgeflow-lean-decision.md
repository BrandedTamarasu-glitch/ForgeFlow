---
name: forgeflow-lean-decision
description: Show a read-only minimum-sufficient-solution decision before implementation
argument-hint: "[--task <text>] [--brief <path>] [--json]"
allowed-tools:
  - Bash
---
<objective>
Show a read-only lean decision for a proposed work item: what to reuse first, what to avoid first, what must not be simplified, the minimum validation, and the known ceiling or upgrade trigger.
</objective>

<process>
Validate `$ARGUMENTS`. Supported args: `--task <text>`, `--brief <path>`, and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/render-lean-decision.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -f "${HELPER_DIR}/render-lean-decision.js" ]; then
  echo "Lean decision helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-decision."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
ARGS="${ARGUMENTS:-}"
JSON_FLAG=false
case "$ARGS" in
  --json) JSON_FLAG=true; ARGS="" ;;
  --json\ *) JSON_FLAG=true; ARGS="${ARGS#--json }" ;;
  *\ --json) JSON_FLAG=true; ARGS="${ARGS% --json}" ;;
esac
[ "$JSON_FLAG" = true ] && SAFE_ARGS+=(--json)
case "$ARGS" in
  "") ;;
  --task\ *) SAFE_ARGS+=(--task "${ARGS#--task }") ;;
  --brief\ *) SAFE_ARGS+=(--brief "${ARGS#--brief }") ;;
  *) echo "Unsupported arguments for /forgeflow-lean-decision"; exit 2 ;;
esac
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-decision.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is read-only and advisory.
- [ ] Output names reuse candidates, avoid-first guidance, do-not-simplify boundaries, validation minimum, and upgrade trigger.
- [ ] Missing task text asks for `--task` or `--brief` instead of inventing a decision.
</success_criteria>
