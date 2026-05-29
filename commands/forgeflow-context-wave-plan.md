---
name: forgeflow-context-wave-plan
description: Plan smaller review waves when the latest context pack is over budget
argument-hint: "[--write-wave-files] [--json]"
allowed-tools:
  - Bash
---
<objective>
Show a wave plan for splitting an over-budget context pack into smaller review packets. Default mode is read-only; `--write-wave-files` writes only explicit file-list inputs for follow-up packet builds.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--write-wave-files` and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-context-wave-plan.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-context-wave-plan.js" ]; then
  echo "Context wave plan helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-context-wave-plan."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --write-wave-files) SAFE_ARGS+=(--write-wave-files) ;;
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-context-wave-plan"; exit 2 ;;
  esac
done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-context-wave-plan.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output explains whether splitting is recommended.
- [ ] Output gives focused wave commands without spawning agents or rebuilding packets.
- [ ] Wave files are written only when `--write-wave-files` is explicit.
</success_criteria>
