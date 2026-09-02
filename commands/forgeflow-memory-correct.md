---
name: forgeflow-memory-correct
description: Preview or append an exact project-memory correction without rewriting history
argument-hint: "--id <candidate-id> --replacement <text> [--write] [--json]"
allowed-tools:
  - Bash
---
<objective>
Correct one exact, ID-stamped project learning. The default is a read-only preview. Only `--write` appends a replacement learning and a retirement event for the old learning.
</objective>

<context>
`$ARGUMENTS` requires:

- `--id <candidate-id>`: the exact active project-learning candidate ID.
- `--replacement <text>`: the replacement guidance.
- `--write`: explicitly append the two correction records. Without it, nothing is written.
- `--json`: structured output.

This command is project-only. It never reads, writes, or changes user-profile preferences. It never deletes or rewrites existing memory. Legacy candidates without IDs remain readable but cannot be safely corrected by this command.
</context>

<process>
Before Bash, validate `$ARGUMENTS` and build an argv array. Reject unknown flags, missing values, duplicate flags, shell metacharacters, private URLs, credentials, secrets, customer data, source snippets, and filesystem paths in the replacement. Do not pass raw arguments to the shell.

Resolve the current project and helper:

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/correct-project-learning.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -f "${HELPER_DIR}/correct-project-learning.js" ]; then
  echo "Project-memory correction helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-memory-correct."
  exit 1
fi
SAFE_ARGS=(--project-dir "${FORGEFLOW_DIR}" --id "$VALIDATED_ID" --replacement "$VALIDATED_REPLACEMENT")
# Append --write and --json only when each was explicitly present and validated.
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/correct-project-learning.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Without `--write`, output identifies the exact old learning, proposed replacement, and the two append-only records, without changing project memory.
- [ ] With `--write`, the helper appends one active replacement and one retirement event for the exact target ID.
- [ ] The helper rejects wrong, ambiguous, inactive, or legacy/no-ID targets and unsafe replacement text or destinations.
- [ ] User-profile memory is never read or changed; no memory record is deleted or silently rewritten.
</success_criteria>
