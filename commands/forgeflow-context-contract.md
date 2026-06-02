---
name: forgeflow-context-contract
description: Check generated agent context packets against the agent context contract
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Validate generated Forgeflow context packets against `agent-context-contract.json`, required packet sections, section-size limits, and advisory-boundary wording.
</objective>

<process>
Validate `$ARGUMENTS`. Only `--json` is supported.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
CONTEXT_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}/context/latest"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/check-context-contract.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -f "${HELPER_DIR}/check-context-contract.js" ]; then
  echo "Context contract helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-context-contract."
  exit 1
fi
SAFE_ARGS=(--context-dir "${CONTEXT_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-context-contract"; exit 2 ;;
  esac
done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/check-context-contract.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is read-only.
- [ ] Missing or malformed context contracts are actionable.
</success_criteria>
