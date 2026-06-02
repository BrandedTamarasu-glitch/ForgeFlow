---
name: forgeflow-project-brief
description: Summarize local project intelligence into a concise decision brief for the next work item
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Show a read-only project decision brief from existing Forgeflow learnings, latest insights, health timeline, and code topology artifacts.
</objective>

<process>
Validate `$ARGUMENTS`. Only `--json` is supported.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/render-project-decision-brief.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -f "${HELPER_DIR}/render-project-decision-brief.js" ]; then
  echo "Project decision brief helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-project-brief."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-project-brief"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-project-decision-brief.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is read-only.
- [ ] Output summarizes decisions, risks, topology status, and recommended next approach.
- [ ] Missing or stale intelligence points to a refresh command instead of inventing evidence.
</success_criteria>
