---
name: forgeflow-review-autofix-sandbox
description: Generate an isolated review-auto fix proposal from deterministic proposal JSON
argument-hint: "--proposal <json> [--json]"
allowed-tools:
  - Bash
---
<objective>
Create a local review-auto sandbox proposal without mutating the source checkout.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--proposal <path>` and optional `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/run-review-autofix-sandbox.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/run-review-autofix-sandbox.js" ]; then
  echo "Review-auto sandbox helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-review-autofix-sandbox."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
RAW_ARGS="${ARGUMENTS:-}"
case "$RAW_ARGS" in
  --proposal\ *)
    value="${RAW_ARGS#--proposal }"
    case "$value" in
      *" --json") value="${value% --json}"; SAFE_ARGS+=(--json) ;;
    esac
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    if [ -z "$value" ] || [[ "$value" == --* ]]; then echo "Missing value for --proposal"; exit 2; fi
    SAFE_ARGS+=(--proposal "$value")
    ;;
  --json\ --proposal\ *)
    value="${RAW_ARGS#--json --proposal }"
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    if [ -z "$value" ] || [[ "$value" == --* ]]; then echo "Missing value for --proposal"; exit 2; fi
    SAFE_ARGS+=(--json --proposal "$value")
    ;;
  *) echo "Unsupported arguments for /forgeflow-review-autofix-sandbox"; exit 2 ;;
esac
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/run-review-autofix-sandbox.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output artifacts stay under `.forgeflow/<project>/review-auto/proposals/`.
- [ ] The source checkout is not modified by the runner.
- [ ] The proposal finding must already be eligible under the Phase 4 sandbox policy.
- [ ] Focused validation runs in the isolated sandbox, not the source checkout.
</success_criteria>
