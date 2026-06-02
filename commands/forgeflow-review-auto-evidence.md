---
name: forgeflow-review-auto-evidence
description: Export a local review-auto classification evidence artifact from findings JSON
argument-hint: "--findings <json> [--json]"
allowed-tools:
  - Bash
---
<objective>
Create a local read-only evidence report showing what `/review-auto` would classify as safe, risky, or blocker before any fixes are applied.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--findings <path>` and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-review-auto-evidence.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-review-auto-evidence.js" ]; then
  echo "Review-auto evidence helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-review-auto-evidence."
  exit 1
fi
SAFE_ARGS=(--project-dir "${FORGEFLOW_DIR}")
RAW_ARGS="${ARGUMENTS:-}"
case "$RAW_ARGS" in
  --findings\ *)
    value="${RAW_ARGS#--findings }"
    case "$value" in
      *" --json") value="${value% --json}"; SAFE_ARGS+=(--json) ;;
    esac
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    if [ -z "$value" ] || [[ "$value" == --* ]]; then echo "Missing value for --findings"; exit 2; fi
    SAFE_ARGS+=(--findings "$value")
    ;;
  --json\ --findings\ *)
    value="${RAW_ARGS#--json --findings }"
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    if [ -z "$value" ] || [[ "$value" == --* ]]; then echo "Missing value for --findings"; exit 2; fi
    SAFE_ARGS+=(--json --findings "$value")
    ;;
  *) echo "Unsupported arguments for /forgeflow-review-auto-evidence"; exit 2 ;;
esac
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-review-auto-evidence.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is read-only with respect to source files.
- [ ] Evidence artifact stays under `.forgeflow/<project>/`.
- [ ] Safe, risky, and blocker buckets include reasons.
</success_criteria>
