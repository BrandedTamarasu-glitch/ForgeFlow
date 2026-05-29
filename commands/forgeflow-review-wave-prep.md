---
name: forgeflow-review-wave-prep
description: Prepare the first focused review wave when context is over budget
argument-hint: "[--write-wave-files] [--json]"
allowed-tools:
  - Bash
---
<objective>
Show the first focused review wave to use before spawning reviewers when the latest context pack is over budget.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--write-wave-files` and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-review-wave-prep.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-review-wave-prep.js" ]; then
  echo "Review wave prep helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-review-wave-prep."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --write-wave-files) SAFE_ARGS+=(--write-wave-files) ;;
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-review-wave-prep"; exit 2 ;;
  esac
done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-review-wave-prep.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output gives the first review wave or confirms the current packet is usable.
- [ ] Output does not rebuild packets, spawn reviewers, edit source files, commit, or push.
</success_criteria>
