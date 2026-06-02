---
name: forgeflow-first-run-rollup
description: Summarize local first-run result evidence for onboarding friction trends
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Summarize local first-run result records as aggregate onboarding evidence. This command does not share raw records and does not call the network.
</objective>

<context>
$ARGUMENTS:
- `--json` - structured output.
</context>

<process>
Validate `$ARGUMENTS`. Accept only `--json`; reject every other flag or shell metacharacter.

Resolve helper:

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/rollup-first-run-results.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -f "${HELPER_DIR}/rollup-first-run-results.js" ]; then
  echo "First-run rollup helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-first-run-rollup."
  exit 1
fi
SAFE_ARGS=(--project-dir "${FORGEFLOW_DIR}")
case "${ARGUMENTS:-}" in
  "") ;;
  "--json") SAFE_ARGS+=(--json) ;;
  *) echo "Unsupported arguments for /forgeflow-first-run-rollup"; exit 2 ;;
esac
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/rollup-first-run-results.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output shows aggregate counts for runtime, health, smoke, profile, decision, and friction.
- [ ] Output keeps raw first-run result files local.
</success_criteria>
