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
if [ ! -f "${HELPER_DIR}/record-command-interface-observation.js" ]; then HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"; fi
if [ ! -f "${HELPER_DIR}/record-command-interface-observation.js" ]; then echo "Command observation helper is not installed. Run /update-forgeflow --repair, then retry."; exit 1; fi
SAFE_ARGS=(--project-dir "${PROJECT_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
i=0
while [ "$i" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$i]}"
  case "$arg" in
    --work-item-id|--command-id|--outcome|--command-calls|--decision-output-bytes) i=$((i + 1)); value="${USER_ARGS[$i]:-}"; [ -n "$value" ] || { echo "Missing value for $arg"; exit 2; }; SAFE_ARGS+=("$arg" "$value") ;;
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-command-interface-observe"; exit 2 ;;
  esac
  i=$((i + 1))
done
for required in --work-item-id --command-id --outcome; do [[ " ${SAFE_ARGS[*]} " == *" ${required} "* ]] || { echo "Missing required ${required}"; exit 2; }; done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/record-command-interface-observation.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Capture is local and sanitized.
- [ ] No raw command/output data is accepted or persisted.
- [ ] Capture does not audit, promote memory, or create wrappers.
</success_criteria>
