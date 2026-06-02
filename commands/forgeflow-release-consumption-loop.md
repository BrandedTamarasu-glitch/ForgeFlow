---
name: forgeflow-release-consumption-loop
description: Show the ordered post-release update, smoke, and consumption follow-through loop
argument-hint: "[--with-smoke] [--json]"
allowed-tools:
  - Bash
---
<objective>
Show the next read-only step for completing release consumption after publishing, updating, downstream smoke, and release-consumption verification.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--with-smoke` and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/render-release-consumption-loop.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -f "${HELPER_DIR}/render-release-consumption-loop.js" ]; then
  echo "Release consumption loop helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-release-consumption-loop."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --with-smoke) SAFE_ARGS+=(--with-smoke) ;;
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-release-consumption-loop"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-release-consumption-loop.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is read-only.
- [ ] Output shows update, downstream smoke, release-consumption, and next command.
- [ ] Downstream smoke only runs when `--with-smoke` is explicitly supplied.
</success_criteria>
