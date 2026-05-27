---
name: forgeflow-next-work-outcome
description: Record local feedback on whether a Forgeflow next-work recommendation was useful
argument-hint: "--title <text> --source <source> --outcome useful|ignored|incorrect|blocked [--summary <text>] [--confidence low|medium|high] [--json]"
allowed-tools:
  - Bash
---
<objective>
Record local advisory feedback about a next-work recommendation so project intelligence can calibrate future suggestions.
</objective>

<context>
$ARGUMENTS supports:
- `--title <public-safe text>`
- `--source <public-safe source>`
- `--outcome useful|ignored|incorrect|blocked`
- `--summary <public-safe text>`
- `--confidence low|medium|high`
- `--json`
</context>

<process>
Before Bash, validate `$ARGUMENTS` and build an argv array. Reject unknown flags, shell metacharacters, secrets, private URLs, paths, source snippets, and customer names. Do not pass raw unvalidated arguments to the shell.

Resolve helper:

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/record-next-work-outcome.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/record-next-work-outcome.js" ]; then
  echo "Next-work outcome helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-next-work-outcome."
  exit 1
fi
SAFE_ARGS=(--project-dir "${FORGEFLOW_DIR}")
# Append only validated flags and values to SAFE_ARGS.
"${HELPER_DIR}/record-next-work-outcome.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Outcome is appended to `.forgeflow/<project>/next-work-outcomes.jsonl`.
- [ ] Project intelligence can use the aggregate outcome history as advisory calibration only.
</success_criteria>
