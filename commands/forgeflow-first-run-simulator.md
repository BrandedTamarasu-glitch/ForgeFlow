---
name: forgeflow-first-run-simulator
description: Simulate a fresh Forgeflow first-run path and source readiness without changing install state
argument-hint: "[--runtime claude-code|codex] [--skip-smoke] [--json]"
allowed-tools:
  - Bash
---
<objective>
Check whether a fresh user has a usable first-run path, release version evidence, and source smoke readiness.
</objective>

<context>
This command is local and read-only. It does not install, update, repair, record evidence, call the network, commit, or push.
</context>

<process>
Validate `$ARGUMENTS`. Accept `--runtime claude-code|codex`, `--skip-smoke`, and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/render-first-run-simulator.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -f "${HELPER_DIR}/render-first-run-simulator.js" ]; then
  echo "First-run simulator helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-first-run-simulator."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
idx=0
while [ "$idx" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$idx]}"
  case "$arg" in
    --runtime)
      idx=$((idx + 1))
      runtime="${USER_ARGS[$idx]:-}"
      case "$runtime" in
        claude-code|codex) SAFE_ARGS+=(--runtime "$runtime") ;;
        *) echo "Invalid --runtime for /forgeflow-first-run-simulator"; exit 2 ;;
      esac
      ;;
    --skip-smoke) SAFE_ARGS+=(--skip-smoke) ;;
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-first-run-simulator"; exit 2 ;;
  esac
  idx=$((idx + 1))
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-first-run-simulator.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output includes release version, first-use path, and source smoke readiness.
- [ ] Output includes the next first-run command or the blocker to clear first.
- [ ] Output states the local read-only boundary.
</success_criteria>
