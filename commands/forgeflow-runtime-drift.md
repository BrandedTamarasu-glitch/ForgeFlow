---
name: forgeflow-runtime-drift
description: Compare source runtime helpers against installed Forgeflow runtime helpers
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Show a read-only snapshot of source-vs-installed runtime helper drift, including missing helpers, content drift, mode drift, and syntax failures.
</objective>

<process>
Validate `$ARGUMENTS`. Only `--json` is supported.

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
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-runtime-drift"; exit 2 ;;
  esac
done
"${HELPER_DIR}/runtime-drift-snapshot.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is read-only.
- [ ] Drift recommendations point to explicit repair commands.
</success_criteria>
