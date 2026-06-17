---
name: forgeflow-lean-prime
description: Show the first-run path to make lean guidance ready for context injection
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Show one read-only first-run checklist for lean guidance: mode, decision evidence, report evidence, telemetry quality, context-injection eligibility, and the next concrete command.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments or `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-prime.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-prime.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-prime.js" ]; then
  echo "Lean prime helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-prime."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "") ;;
    --json) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-lean-prime"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-prime.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output shows mode, decision, report, telemetry, and context-injection steps.
- [ ] Output gives one next command to clear the first blocker.
- [ ] The command is read-only and does not write artifacts, edit settings, change routing, install hooks, commit, push, or call the network.
</success_criteria>
