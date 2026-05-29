---
name: forgeflow-output-contract
description: Spot-check helper output shape for status, next, reason, and boundary fields
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Run a read-only output contract audit across representative helpers so common command output stays predictable.
</objective>

<process>
Validate `$ARGUMENTS`. Only `--json` is supported.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/output-contract.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/output-contract.js" ]; then
  echo "Output contract helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-output-contract."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}" --home "$HOME/.claude")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-output-contract"; exit 2 ;;
  esac
done
"${HELPER_DIR}/output-contract.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is read-only.
- [ ] Output reports representative helper contract issues with source names.
- [ ] Output includes copy-pastable next command and separate reason.
</success_criteria>
