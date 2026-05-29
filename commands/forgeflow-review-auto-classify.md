---
name: forgeflow-review-auto-classify
description: Preview review-auto safe, risky, and blocker buckets from captured findings JSON
argument-hint: "--findings <json> [--json]"
allowed-tools:
  - Bash
---
<objective>
Classify captured review findings using `/review-auto` safety policy without editing files, dispatching workers, committing, or pushing.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--findings <path>` and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/classify-review-auto.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/classify-review-auto.js" ]; then
  echo "Review-auto classifier helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-review-auto-classify."
  exit 1
fi
SAFE_ARGS=()
RAW_ARGS="${ARGUMENTS:-}"
case "$RAW_ARGS" in
  "") ;;
  --json) SAFE_ARGS+=(--json) ;;
  --findings\ *)
    value="${RAW_ARGS#--findings }"
    if [ -z "$value" ]; then echo "Missing value for --findings"; exit 2; fi
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
  *) echo "Unsupported arguments for /forgeflow-review-auto-classify"; exit 2 ;;
esac
"${HELPER_DIR}/classify-review-auto.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is read-only and does not apply fixes.
- [ ] Warden/security/dependency/migration/secret findings are not auto-applicable.
- [ ] Safe findings are clearly separated from risky and blocker findings.
</success_criteria>
