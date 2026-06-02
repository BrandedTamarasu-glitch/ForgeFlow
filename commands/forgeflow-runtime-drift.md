---
name: forgeflow-runtime-drift
description: Compare source runtime helpers against installed Forgeflow runtime helpers
argument-hint: "[--preview-repair] [--json]"
allowed-tools:
  - Bash
---
<objective>
Show a read-only snapshot of source-vs-installed runtime helper drift, including missing helpers, content drift, mode drift, syntax failures, and optional repair preview.
</objective>

<process>
Validate `$ARGUMENTS`. Only `--preview-repair` and `--json` are supported.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/runtime-drift-snapshot.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/runtime-drift-snapshot.js" ]; then
  echo "Runtime drift helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-runtime-drift."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --install-root "$HOME/.claude")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --preview-repair) SAFE_ARGS+=(--preview-repair) ;;
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-runtime-drift"; exit 2 ;;
  esac
done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/runtime-drift-snapshot.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is read-only.
- [ ] Drift recommendations point to explicit repair commands.
- [ ] Repair preview is read-only when requested.
</success_criteria>
