---
name: forgeflow-validation-failure-capture
description: Plan the safe capture mode for a failed validation command
argument-hint: "--command <cmd> [--json]"
allowed-tools:
  - Bash
---
<objective>
Map a failed validation command to the safest `/forgeflow-capture-output` mode and failure-digest path without executing anything.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--command` and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-validation-failure-capture.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-validation-failure-capture.js" ]; then
  echo "Validation failure capture helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-validation-failure-capture."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --args "${ARGUMENTS:-}")
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-validation-failure-capture.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output maps failed validation commands to safe capture modes.
- [ ] Exact diff, patch, hash, and file-list commands stay raw-required.
- [ ] Output does not execute commands or write digests.
</success_criteria>
