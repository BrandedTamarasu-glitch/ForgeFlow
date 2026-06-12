---
name: forgeflow-output-contract
description: Spot-check helper output shape and optional lean narrative budgets
argument-hint: "[--lean-file <path>] [--json]"
allowed-tools:
  - Bash
---
<objective>
Run a read-only output contract audit across representative helpers so common command output stays predictable.
</objective>

<process>
Validate `$ARGUMENTS`. Only `--json` and repeated `--lean-file <path>` are supported.

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
i=0
while [ "$i" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$i]}"
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    --lean-file)
      i=$((i + 1))
      if [ "$i" -ge "${#USER_ARGS[@]}" ]; then
        echo "Missing value for --lean-file"
        exit 2
      fi
      SAFE_ARGS+=(--lean-file "${USER_ARGS[$i]}")
      ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-output-contract"; exit 2 ;;
  esac
  i=$((i + 1))
done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/output-contract.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is read-only.
- [ ] Output reports representative helper contract issues with source names.
- [ ] Lean warnings are advisory and preserve raw-required evidence.
- [ ] Output includes copy-pastable next command and separate reason.
</success_criteria>
