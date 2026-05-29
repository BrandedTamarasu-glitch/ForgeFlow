---
name: forgeflow-context-wave-build
description: Build the first focused context packet from an over-budget review wave
argument-hint: "[--wave <name>] [--json]"
allowed-tools:
  - Bash
---
<objective>
Build one focused context packet from the latest over-budget context wave plan. This writes only local `.forgeflow` wave artifacts and does not spawn reviewers.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--wave <name>` and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/build-context-wave.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/build-context-wave.js" ]; then
  echo "Context wave build helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-context-wave-build."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
index=0
while [ "$index" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$index]}"
  case "$arg" in
    --wave)
      index=$((index + 1))
      value="${USER_ARGS[$index]:-}"
      if [ -z "$value" ] || [[ "$value" == --* ]]; then
        echo "Missing value for --wave"
        exit 2
      fi
      SAFE_ARGS+=(--wave "$value")
      ;;
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-context-wave-build"; exit 2 ;;
  esac
  index=$((index + 1))
done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/build-context-wave.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output either builds the first focused wave packet or explains why the current packet is already usable.
- [ ] Output names the wave file list and focused context-pack directory when a packet is built.
- [ ] Output does not spawn reviewers, edit source files, commit, or push.
</success_criteria>
