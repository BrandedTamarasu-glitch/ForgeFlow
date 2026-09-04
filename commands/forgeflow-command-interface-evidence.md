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
if [ ! -f "${HELPER_DIR}/command-interface-evidence.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -f "${HELPER_DIR}/command-interface-evidence.js" ]; then
  echo "Command interface evidence helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-command-interface-evidence."
  exit 1
fi
SAFE_ARGS=()
HAS_INPUT=false
HAS_PROJECT_DIR=false
WANTS_WRITE=false
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
i=0
while [ "$i" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$i]}"
  case "$arg" in
    --input)
      i=$((i + 1))
      value="${USER_ARGS[$i]:-}"
      if [ -z "$value" ]; then
        echo "Missing value for --input"
        exit 2
      fi
      SAFE_ARGS+=(--input "$value")
      HAS_INPUT=true
      ;;
    --project-dir)
      i=$((i + 1))
      value="${USER_ARGS[$i]:-}"
      if [ -z "$value" ]; then
        echo "Missing value for --project-dir"
        exit 2
      fi
      SAFE_ARGS+=(--project-dir "$value")
      HAS_PROJECT_DIR=true
      ;;
    --write-report)
      SAFE_ARGS+=(--write-report)
      WANTS_WRITE=true
      ;;
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-command-interface-evidence"; exit 2 ;;
  esac
  i=$((i + 1))
done
if [ "$HAS_INPUT" != true ]; then
  echo "Missing required --input for /forgeflow-command-interface-evidence"
  exit 2
fi
if [ "$WANTS_WRITE" = true ] && [ "$HAS_PROJECT_DIR" != true ]; then
  echo "--write-report requires --project-dir for /forgeflow-command-interface-evidence"
  exit 2
fi
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/command-interface-evidence.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Only explicitly supplied, schema-validated sanitized observations are assessed.
- [ ] The default path is read-only; report writes are aggregate-only and session-confined.
- [ ] Results identify evidence gaps without claiming savings or creating/promoting wrappers.
</success_criteria>
