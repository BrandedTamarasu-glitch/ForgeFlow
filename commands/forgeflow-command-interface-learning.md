---
name: forgeflow-command-interface-learning
description: Preview or explicitly promote aggregate command-interface evidence into advisory local project memory
argument-hint: "--input <path> [--candidate-id <id> --write] [--set-suggestions on|off --write-policy] [--json]"
allowed-tools:
  - Bash
---
<objective>
Turn only qualifying sanitized aggregate command-interface patterns into previewable local memory. Suggestions are on by default but may be suppressed; durable memory always needs an exact candidate ID and `--write`.
</objective>

<process>
Accept only `--input <path>`, `--candidate-id <id> --write`, `--set-suggestions on|off --write-policy`, and `--json`. Do not pass raw output, command text, or paths as learning content.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
PROJECT_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
ARG_HELPER="${ROOT}/scripts/forgeflow/command-args.js"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
if [ ! -f "${HELPER_DIR}/command-interface-learning.js" ]; then HELPER_DIR="${CODEX_HOME}/forgeflow/scripts/forgeflow"; fi
if [ ! -f "${HELPER_DIR}/command-interface-learning.js" ]; then HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"; fi
if [ ! -f "${HELPER_DIR}/command-interface-learning.js" ]; then echo "Command interface learning helper is not installed. Run /update-forgeflow --repair, then retry."; exit 1; fi
if [ ! -f "${ARG_HELPER}" ]; then ARG_HELPER="${CODEX_HOME}/forgeflow/scripts/forgeflow/command-args.js"; fi
if [ ! -f "${ARG_HELPER}" ]; then ARG_HELPER="$HOME/.claude/forgeflow/scripts/forgeflow/command-args.js"; fi
if [ ! -f "${ARG_HELPER}" ]; then echo "Command argument helper is not installed. Run /update-forgeflow --repair, then retry."; exit 1; fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${PROJECT_DIR}")
ARGS_FILE="$(mktemp)" || exit 1
if ! env -u NODE_OPTIONS -u NODE_PATH node "${ARG_HELPER}" --allow "--input:path,--candidate-id:value,--set-suggestions:value,--write:boolean,--write-policy:boolean,--json:boolean" --args "${ARGUMENTS:-}" --nul > "${ARGS_FILE}"; then rm -f "${ARGS_FILE}"; exit 2; fi
USER_ARGS=()
while IFS= read -r -d $'\0' arg; do
  USER_ARGS+=("$arg")
done < "${ARGS_FILE}"
rm -f "${ARGS_FILE}"
SAFE_ARGS+=("${USER_ARGS[@]}")
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/command-interface-learning.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Preview never writes durable memory.
- [ ] Suppression changes only suggestion display.
- [ ] Durable writes require an exact preview ID and `--write`.
</success_criteria>
