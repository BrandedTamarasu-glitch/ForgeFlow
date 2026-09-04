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
if [ ! -f "${HELPER_DIR}/command-interface-learning.js" ]; then HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"; fi
if [ ! -f "${HELPER_DIR}/command-interface-learning.js" ]; then echo "Command interface learning helper is not installed. Run /update-forgeflow --repair, then retry."; exit 1; fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${PROJECT_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
i=0
while [ "$i" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$i]}"
  case "$arg" in
    --input|--candidate-id|--set-suggestions) i=$((i + 1)); value="${USER_ARGS[$i]:-}"; [ -n "$value" ] || { echo "Missing value for $arg"; exit 2; }; SAFE_ARGS+=("$arg" "$value") ;;
    --write|--write-policy|--json) SAFE_ARGS+=("$arg") ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-command-interface-learning"; exit 2 ;;
  esac
  i=$((i + 1))
done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/command-interface-learning.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Preview never writes durable memory.
- [ ] Suppression changes only suggestion display.
- [ ] Durable writes require an exact preview ID and `--write`.
</success_criteria>
