---
name: forgeflow-review-autofix-status
description: Show read-only status for review-auto proposal, sandbox, and apply artifacts
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Show where the current project is in the deterministic review-auto proposal, sandbox, and apply flow.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments or `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/show-review-autofix-status.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/show-review-autofix-status.js" ]; then
  echo "Review-auto status helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-review-autofix-status."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
RAW_ARGS="${ARGUMENTS:-}"
case "$RAW_ARGS" in
  "") ;;
  "--json") SAFE_ARGS+=(--json) ;;
  *) echo "Unsupported arguments for /forgeflow-review-autofix-status"; exit 2 ;;
esac
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/show-review-autofix-status.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Proposal inputs, sandbox proposals, apply artifacts, and apply history are summarized.
- [ ] The command reports the next safe action.
- [ ] The command is read-only and never generates, applies, commits, pushes, calls GitHub, or claims review approval.
</success_criteria>
