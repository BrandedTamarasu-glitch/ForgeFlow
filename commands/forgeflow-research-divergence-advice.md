---
name: forgeflow-research-divergence-advice
description: Recommend normal or divergent research without automatically running either route.
argument-hint: "<task> [--json]"
allowed-tools:
  - Bash
---
<objective>
Provide a deterministic, read-only recommendation for `$research` or `$research --diverge`. This command is advisory-only: it never invokes research, models, agents, state initialization, telemetry, writes, or network access.
</objective>

<process>
Treat all text other than a trailing `--json` as the task. Reject an empty task.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/render-research-divergence-advice.js" ] && [ -f "$HOME/.claude/forgeflow/scripts/forgeflow/render-research-divergence-advice.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -f "${HELPER_DIR}/render-research-divergence-advice.js" ]; then
  echo "Research divergence advice helper is not installed. Run /update-forgeflow --repair, then retry."
  exit 1
fi
TASK="${ARGUMENTS:-}"
JSON=""
if [[ "$TASK" == *" --json" ]]; then JSON="--json"; TASK="${TASK% --json}"; fi
if [ -z "${TASK//[[:space:]]/}" ]; then echo "A task is required."; exit 2; fi
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-research-divergence-advice.js" --task "$TASK" $JSON
```
</process>

<evidence_boundary>
The advice reflects one clean development-set pilot, not automated-routing accuracy, human validation, holdout evidence, or general superiority. Users retain the decision and may explicitly choose either research route.
</evidence_boundary>
