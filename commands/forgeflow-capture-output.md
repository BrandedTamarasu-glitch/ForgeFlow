---
name: forgeflow-capture-output
description: Compact provided command output safely and optionally save a failure digest
argument-hint: "--mode <mode> --command <cmd> [--file <path>] [--out <path>] [--json]"
allowed-tools:
  - Bash
---
<objective>
Capture already-produced command output before it enters agent context. Unsafe exact-output classes are preserved raw.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--mode`, `--command`, `--file`, `--out`, and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/capture-command-output.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/capture-command-output.js" ]; then
  echo "Command output capture helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-capture-output."
  exit 1
fi
SAFE_ARGS=()
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
idx=0
while [ "${idx}" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$idx]}"
  case "$arg" in
    --mode|--command|--file|--out)
      idx=$((idx + 1))
      value="${USER_ARGS[$idx]:-}"
      if [ -z "${value}" ]; then echo "Missing value for ${arg}"; exit 2; fi
      SAFE_ARGS+=("${arg}" "${value}")
      ;;
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-capture-output"; exit 2 ;;
  esac
  idx=$((idx + 1))
done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/capture-command-output.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output states that the helper did not execute the command.
- [ ] Unsafe exact output is preserved raw.
- [ ] `--out` writes only the requested digest path.
</success_criteria>
