---
name: forgeflow-release-follow-through
description: Check post-release follow-through after publishing and update verification
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Summarize the local post-release checklist after a Forgeflow release: post-publish verify, update verify, and runtime consumability.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-release-follow-through.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-release-follow-through.js" ]; then
  echo "Release follow-through helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-release-follow-through."
  exit 1
fi
SAFE_ARGS=()
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-release-follow-through"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-release-follow-through.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output includes the release follow-through checklist and next action.
- [ ] The command is local and read-only.
</success_criteria>
