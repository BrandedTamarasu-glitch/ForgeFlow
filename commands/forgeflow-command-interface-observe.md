---
name: forgeflow-command-interface-observe
description: Record one sanitized local command observation for command-interface evidence
argument-hint: "--work-item-id <id> --command-id <id> --outcome success|failure|partial|cancelled [--command-calls <n>] [--decision-output-bytes <n>] [--json]"
allowed-tools:
  - Bash
---
<objective>
Record only a normalized command ID, local work-item ID, outcome, and compact counts. Never provide shell text, arguments, file paths, command output, secrets, or transcripts.
</objective>

<process>
Require `--work-item-id`, `--command-id`, and `--outcome`. Accept only `--command-calls`, `--decision-output-bytes`, and `--json` in addition. The resulting local dataset can be passed to `/forgeflow-command-interface-evidence` and `/forgeflow-command-interface-learning`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
PROJECT_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
ARG_HELPER="${ROOT}/scripts/forgeflow/command-args.js"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
if [ ! -f "${HELPER_DIR}/record-command-interface-observation.js" ]; then HELPER_DIR="${CODEX_HOME}/forgeflow/scripts/forgeflow"; fi
if [ ! -f "${HELPER_DIR}/record-command-interface-observation.js" ]; then HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"; fi
if [ ! -f "${HELPER_DIR}/record-command-interface-observation.js" ]; then echo "Command observation helper is not installed. Run /update-forgeflow --repair, then retry."; exit 1; fi
if [ ! -f "${ARG_HELPER}" ]; then ARG_HELPER="${CODEX_HOME}/forgeflow/scripts/forgeflow/command-args.js"; fi
if [ ! -f "${ARG_HELPER}" ]; then ARG_HELPER="$HOME/.claude/forgeflow/scripts/forgeflow/command-args.js"; fi
if [ ! -f "${ARG_HELPER}" ]; then echo "Command argument helper is not installed. Run /update-forgeflow --repair, then retry."; exit 1; fi
SAFE_ARGS=(--project-dir "${PROJECT_DIR}")
ARGS_FILE="$(mktemp)" || exit 1
if ! env -u NODE_OPTIONS -u NODE_PATH node "${ARG_HELPER}" --allow "--work-item-id:value,--command-id:value,--outcome:value,--command-calls:value,--decision-output-bytes:value,--json:boolean" --args "${ARGUMENTS:-}" --nul > "${ARGS_FILE}"; then rm -f "${ARGS_FILE}"; exit 2; fi
USER_ARGS=()
while IFS= read -r -d $'\0' arg; do
  USER_ARGS+=("$arg")
done < "${ARGS_FILE}"
rm -f "${ARGS_FILE}"
SAFE_ARGS+=("${USER_ARGS[@]}")
for required in --work-item-id --command-id --outcome; do [[ " ${SAFE_ARGS[*]} " == *" ${required} "* ]] || { echo "Missing required ${required}"; exit 2; }; done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/record-command-interface-observation.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Capture is local and sanitized.
- [ ] No raw command/output data is accepted or persisted.
- [ ] Capture does not audit, promote memory, or create wrappers.
</success_criteria>
