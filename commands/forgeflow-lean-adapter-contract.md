---
name: forgeflow-lean-adapter-contract
description: Validate Forgeflow lean adapter and hook portability contracts
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Validate the local Forgeflow lean adapter matrix, plugin hook wiring, managed helper inventory, and lean command wrappers. This command is read-only.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-adapter-contract.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-adapter-contract.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-adapter-contract.js" ]; then
  echo "Lean adapter contract helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-adapter-contract."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "" ) ;;
    --json) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-lean-adapter-contract"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-adapter-contract.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output reports pass/fail for lean adapter contract checks.
- [ ] The command does not install adapters, edit settings, commit, push, or call the network.
</success_criteria>
