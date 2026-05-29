---
name: forgeflow-first-useful-win
description: Summarize what Forgeflow has already helped with after early project use
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Show a compact local report of the first useful wins from Forgeflow evidence: first-run results, pilot evidence, agent feedback, and learning status.
</objective>

<process>
Validate `$ARGUMENTS`. Only `--json` is supported.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-first-useful-win.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-first-useful-win.js" ]; then
  echo "First useful win helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-first-useful-win."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-first-useful-win"; exit 2 ;;
  esac
done
"${HELPER_DIR}/render-first-useful-win.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is local and public-safe by default.
- [ ] Output explains useful wins without exposing raw project records.
- [ ] Output includes a copy-pastable next command and separate reason.
</success_criteria>
