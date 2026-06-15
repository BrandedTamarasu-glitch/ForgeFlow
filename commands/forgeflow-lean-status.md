---
name: forgeflow-lean-status
description: Show whether lean guidance is configured, blocked, or eligible for context injection
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Show the project-local lean activation state: effective lean mode, context-injection gates, automatic consult/implement/review/ship wiring, helper availability, and the next concrete clearing action. This command is read-only and advisory.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments or `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-status.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-status.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-status.js" ]; then
  echo "Lean status helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-status."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "") ;;
    --json) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-lean-status"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-status.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output shows the effective lean mode and whether guidance is enabled.
- [ ] Output shows each context-injection gate as passing or blocked.
- [ ] Output reports automatic lean command wiring for consult, implement, review, and ship.
- [ ] Output gives one next command to clear the highest-priority blocker.
- [ ] The command does not rebuild context, edit settings, change routing, commit, push, or call the network.
</success_criteria>
