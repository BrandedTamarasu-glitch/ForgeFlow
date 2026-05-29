---
name: forgeflow-next-work-ranking
description: Rank next work candidates from current local evidence and confidence signals
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Show read-only next-work rankings using current project intelligence, context budget, failure digest, outcome, profile, and hot-file signals.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-next-work-ranking.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-next-work-ranking.js" ]; then
  echo "Next-work ranking helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-next-work-ranking."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-next-work-ranking"; exit 2 ;;
  esac
done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-next-work-ranking.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output ranks candidates with evidence, confidence, and demotion conditions.
- [ ] Output stays advisory and does not refresh artifacts, edit files, spawn agents, commit, or push.
</success_criteria>
