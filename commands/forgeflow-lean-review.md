---
name: forgeflow-lean-review
description: Review the current diff for over-engineering-only lean findings
argument-hint: "[--diff <path>] [--json]"
allowed-tools:
  - Bash
---
<objective>
Show a read-only over-engineering review lane for the current diff. It reports only lean complexity findings with explicit tags: `delete`, `stdlib`, `native`, `reuse`, `yagni`, `shrink`, and `prose-bloat`. Findings include static project evidence from topology, invocation hints, and package dependency deltas when those artifacts are available.
</objective>

<process>
Validate `$ARGUMENTS`. Supported args: `--diff <path>` and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/render-lean-review.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -f "${HELPER_DIR}/render-lean-review.js" ]; then
  echo "Lean review helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-review."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
RAW_ARGS="${ARGUMENTS:-}"
case "$RAW_ARGS" in
  "") ;;
  --json) SAFE_ARGS+=(--json) ;;
  --diff\ *)
    value="${RAW_ARGS#--diff }"
    case "$value" in
      *" --json") value="${value% --json}"; SAFE_ARGS+=(--json) ;;
    esac
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    if [ -z "$value" ] || [[ "$value" == --* ]]; then echo "Missing value for --diff"; exit 2; fi
    SAFE_ARGS+=(--diff "$value")
    ;;
  --json\ --diff\ *)
    value="${RAW_ARGS#--json --diff }"
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    if [ -z "$value" ] || [[ "$value" == --* ]]; then echo "Missing value for --diff"; exit 2; fi
    SAFE_ARGS+=(--json --diff "$value")
    ;;
  *) echo "Unsupported arguments for /forgeflow-lean-review"; exit 2 ;;
esac
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-review.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is read-only and does not apply fixes.
- [ ] Findings use only the planned lean tags.
- [ ] Static project evidence is labeled advisory and is not treated as runtime proof.
- [ ] Output says this is not a correctness, security, performance, accessibility, or validation review.
- [ ] Clean diffs end with `Lean already. Ship.`
- [ ] Finding output stays compatible with `/forgeflow-review-evidence-schema`.
</success_criteria>
