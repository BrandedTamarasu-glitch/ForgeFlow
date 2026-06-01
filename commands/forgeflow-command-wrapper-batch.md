---
name: forgeflow-command-wrapper-batch
description: Rank the next small batch of slash-command wrapper contract cleanup candidates
argument-hint: "[--limit <n>] [--json]"
allowed-tools:
  - Bash
---
<objective>
Identify the next command wrapper consolidation batch so command safety and installed/source parity improvements can be handled in small reviewable slices.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--limit <n>` and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-command-wrapper-batch.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-command-wrapper-batch.js" ]; then
  echo "Command wrapper batch helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-command-wrapper-batch."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
i=0
while [ "$i" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$i]}"
  case "$arg" in
    --limit)
      i=$((i + 1))
      value="${USER_ARGS[$i]:-}"
      if [[ ! "$value" =~ ^[0-9]+$ ]]; then
        echo "Unsupported arguments for /forgeflow-command-wrapper-batch"
        exit 2
      fi
      SAFE_ARGS+=(--limit "$value")
      ;;
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-command-wrapper-batch"; exit 2 ;;
  esac
  i=$((i + 1))
done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-command-wrapper-batch.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output ranks wrapper cleanup candidates without editing files.
- [ ] Highest-priority issues are listed before lower-value cleanup.
- [ ] Output is safe to use as a planning input for the next implementation slice.
</success_criteria>
