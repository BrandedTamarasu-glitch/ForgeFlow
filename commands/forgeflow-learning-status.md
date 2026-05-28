---
name: forgeflow-learning-status
description: Show a compact local health view for Forgeflow learning signals
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Summarize local Forgeflow learning signals across project learnings, user profile, agent feedback, review outcomes, next-work outcomes, and first-run results.
</objective>

<context>
This command is local and advisory. It does not promote patterns, approve work, call the network, or share raw local evidence.
</context>

<process>
Validate `$ARGUMENTS`. Only `--json` is supported.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/show-learning-status.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/show-learning-status.js" ]; then
  echo "Learning status helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-learning-status."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-learning-status"; exit 2 ;;
  esac
done
"${HELPER_DIR}/show-learning-status.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output includes all learning signal sections.
- [ ] Recommendations remain advisory and local-first.
</success_criteria>
