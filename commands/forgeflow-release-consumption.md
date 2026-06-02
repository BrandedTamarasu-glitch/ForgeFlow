---
name: forgeflow-release-consumption
description: Roll up post-release consumption evidence with optional downstream smoke and local snapshot saving
argument-hint: "[--with-smoke] [--save] [--json]"
allowed-tools:
  - Bash
---
<objective>
Summarize whether the current Forgeflow release appears consumed after follow-through evidence, with an optional downstream smoke check and optional local snapshot.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--with-smoke`, `--save`, and `--json`.
Without `--save`, this command is read-only. Without `--with-smoke`, it does not run downstream smoke and only reports the smoke command to run.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/render-release-consumption-rollup.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -f "${HELPER_DIR}/render-release-consumption-rollup.js" ]; then
  echo "Release consumption rollup helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-release-consumption."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --with-smoke) SAFE_ARGS+=(--with-smoke) ;;
    --save) SAFE_ARGS+=(--save) ;;
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-release-consumption"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-release-consumption-rollup.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output includes release follow-through status, release-consumption status, downstream smoke status, and next action.
- [ ] The command is local and read-only unless `--save` is explicitly supplied.
- [ ] Downstream smoke only runs when `--with-smoke` is explicitly supplied.
</success_criteria>
