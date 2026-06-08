---
name: forgeflow-review-autofix-apply
description: Apply one validated review-auto sandbox proposal to the local checkout
argument-hint: "--proposal <json> [--json]"
allowed-tools:
  - Bash
---
<objective>
Apply one selected, validated review-auto sandbox proposal to the local checkout with worktree and validation checks.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--proposal <path>` and optional `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/apply-review-autofix-proposal.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/apply-review-autofix-proposal.js" ]; then
  echo "Review-auto apply helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-review-autofix-apply."
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
  *) echo "Unsupported arguments for /forgeflow-review-autofix-apply"; exit 2 ;;
esac
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/apply-review-autofix-proposal.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Only one selected proposal artifact is applied.
- [ ] The helper refuses tracked worktree changes before applying.
- [ ] Exact source text must still match before any file is changed.
- [ ] Failed validation rolls back the changed file.
- [ ] The helper records local apply evidence and never commits, pushes, publishes, calls GitHub, or dispatches workers.
</success_criteria>
