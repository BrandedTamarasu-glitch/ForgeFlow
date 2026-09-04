---
name: forgeflow-command-interface-learning-outcome
description: Preview or record local usefulness feedback for one command-interface learning
argument-hint: "--id <candidate-id> --outcome useful|ignored|incorrect|blocked [--write] [--json]"
allowed-tools:
  - Bash
---
<objective>
Record aggregate local feedback for one exact command-interface learning. Negative feedback suggests the existing append-only memory-correction command; it never changes memory or confidence automatically.
</objective>

<process>
Require only `--id` and `--outcome`; accept optional `--write` and `--json`. Resolve the normal project directory and invoke `record-command-interface-learning-outcome.js` with a strict argv array. Reject unsupported arguments, shell text, and missing values.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_DIR="${ROOT}/.forgeflow/$(basename "${ROOT}")"
HELPER_DIR="${ROOT}/scripts/forgeflow"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
[ -f "${HELPER_DIR}/record-command-interface-learning-outcome.js" ] || HELPER_DIR="${CODEX_HOME}/forgeflow/scripts/forgeflow"
[ -f "${HELPER_DIR}/record-command-interface-learning-outcome.js" ] || HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
[ -f "${HELPER_DIR}/record-command-interface-learning-outcome.js" ] || { echo "Learning outcome helper is not installed. Run /update-forgeflow --repair."; exit 1; }
SAFE_ARGS=(--project-dir "${PROJECT_DIR}")
ARGS_FILE="$(mktemp)" || exit 1
if ! env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/command-args.js" --allow "--id:value,--outcome:value,--write:boolean,--json:boolean" --args "${ARGUMENTS:-}" --nul > "${ARGS_FILE}"; then rm -f "${ARGS_FILE}"; exit 2; fi
USER_ARGS=()
while IFS= read -r -d $'\0' arg; do
  USER_ARGS+=("$arg")
done < "${ARGS_FILE}"
rm -f "${ARGS_FILE}"
SAFE_ARGS+=("${USER_ARGS[@]}")
for required in --id --outcome; do [[ " ${SAFE_ARGS[*]} " == *" ${required} "* ]] || { echo "Missing required ${required}"; exit 2; }; done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/record-command-interface-learning-outcome.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Preview is read-only.
- [ ] A write records only the exact ID and outcome locally.
- [ ] Negative outcomes point to explicit memory correction rather than mutating memory.
</success_criteria>
