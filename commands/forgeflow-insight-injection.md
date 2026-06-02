---
name: forgeflow-insight-injection
description: Show which local insight blocks are injected into agent context packets and why
argument-hint: "[--baseline <packet-artifacts.json>] [--json]"
allowed-tools:
  - Bash
---
<objective>
Explain the latest local context packet insight decisions: which project learnings, profile guidance, code topology, and failure-digest signals were included, downgraded to metadata-only, or skipped for each agent. When a baseline packet-artifacts file is available, show which artifact decisions changed.
</objective>

<context>
`$ARGUMENTS`:
- `--baseline <packet-artifacts.json>` - compare latest packet artifact decisions against a prior manifest.
- `--json` - structured output.
</context>

<process>
Validate `$ARGUMENTS`. Accept only `--baseline <path>` and `--json`; reject every other flag or shell metacharacter.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/render-insight-injection.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -f "${HELPER_DIR}/render-insight-injection.js" ]; then
  echo "Insight injection helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-insight-injection."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
i=0
while [ "$i" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$i]}"
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    --baseline)
      next_index=$((i + 1))
      value="${USER_ARGS[$next_index]:-}"
      if [ -z "$value" ] || [[ "$value" == --* ]]; then echo "Missing value for --baseline"; exit 2; fi
      SAFE_ARGS+=(--baseline "$value")
      i=$next_index
      ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-insight-injection"; exit 2 ;;
  esac
  i=$((i + 1))
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-insight-injection.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is read-only and local-only.
- [ ] Output shows artifact decisions, optional baseline decision diff, per-agent signal use, quality gates, and the next command to clear blocked guidance.
- [ ] Output says injected insights are advisory and do not approve findings or override current instructions.
</success_criteria>
