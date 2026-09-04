---
name: forgeflow-command-interface-evidence
description: Audit explicitly supplied sanitized command-chain observations without collecting history
argument-hint: "--input <path> [--project-dir <path>] [--write-report] [--json]"
allowed-tools:
  - Bash
---
<objective>
Assess aggregate-only, sanitized command-chain observations for evidence gaps and possible future human review. This command never reads raw command output, discovers history, creates wrappers, or promotes a wrapper.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--input <path>`, `--project-dir <path>`, `--write-report`, and `--json`. `--input` is required. A report write requires an explicit `--project-dir` and remains confined to that local Forgeflow session directory.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
ARG_HELPER="${ROOT}/scripts/forgeflow/command-args.js"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
if [ ! -f "${HELPER_DIR}/command-interface-evidence.js" ]; then
  HELPER_DIR="${CODEX_HOME}/forgeflow/scripts/forgeflow"
fi
if [ ! -f "${HELPER_DIR}/command-interface-evidence.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -f "${HELPER_DIR}/command-interface-evidence.js" ]; then
  echo "Command interface evidence helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-command-interface-evidence."
  exit 1
fi
if [ ! -f "${ARG_HELPER}" ]; then ARG_HELPER="${CODEX_HOME}/forgeflow/scripts/forgeflow/command-args.js"; fi
if [ ! -f "${ARG_HELPER}" ]; then ARG_HELPER="$HOME/.claude/forgeflow/scripts/forgeflow/command-args.js"; fi
if [ ! -f "${ARG_HELPER}" ]; then echo "Command argument helper is not installed. Run /update-forgeflow --repair, then retry."; exit 1; fi
SAFE_ARGS=()
ARGS_FILE="$(mktemp)" || exit 1
if ! env -u NODE_OPTIONS -u NODE_PATH node "${ARG_HELPER}" --allow "--input:path,--project-dir:path,--write-report:boolean,--json:boolean" --args "${ARGUMENTS:-}" --nul > "${ARGS_FILE}"; then rm -f "${ARGS_FILE}"; exit 2; fi
USER_ARGS=()
while IFS= read -r -d $'\0' arg; do
  USER_ARGS+=("$arg")
done < "${ARGS_FILE}"
rm -f "${ARGS_FILE}"
SAFE_ARGS+=("${USER_ARGS[@]}")
if [[ " ${SAFE_ARGS[*]} " != *" --input "* ]]; then
  echo "Missing required --input for /forgeflow-command-interface-evidence"
  exit 2
fi
if [[ " ${SAFE_ARGS[*]} " == *" --write-report "* ]] && [[ " ${SAFE_ARGS[*]} " != *" --project-dir "* ]]; then
  echo "--write-report requires --project-dir for /forgeflow-command-interface-evidence"
  exit 2
fi
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/command-interface-evidence.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Only explicitly supplied, schema-validated sanitized observations are assessed.
- [ ] The default path is read-only; report writes are aggregate-only and session-confined.
- [ ] Results identify evidence gaps without claiming savings or creating/promoting wrappers.
</success_criteria>
