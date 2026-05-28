---
name: forgeflow-insight-injection
description: Show which local insight blocks are injected into agent context packets and why
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Explain the latest local context packet insight decisions: which project learnings, profile guidance, code topology, and failure-digest signals were included, downgraded to metadata-only, or skipped for each agent.
</objective>

<context>
`$ARGUMENTS`:
- `--json` - structured output.
</context>

<process>
Validate `$ARGUMENTS`. Accept only `--json`; reject every other flag or shell metacharacter.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-insight-injection.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-insight-injection.js" ]; then
  echo "Insight injection helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-insight-injection."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-insight-injection"; exit 2 ;;
  esac
done
"${HELPER_DIR}/render-insight-injection.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is read-only and local-only.
- [ ] Output shows artifact decisions, per-agent signal use, quality gates, and the next command to clear blocked guidance.
- [ ] Output says injected insights are advisory and do not approve findings or override current instructions.
</success_criteria>
