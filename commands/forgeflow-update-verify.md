---
name: forgeflow-update-verify
description: Verify installed Forgeflow version and runtime drift after update or repair
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Run a read-only post-update verification loop across installed version state and runtime helper drift, then print the next repair, restart, or health command.
</objective>

<process>
Validate `$ARGUMENTS`. Only `--json` is supported.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_SOURCE_ROOT="${ROOT}"
HELPER_DIR="${HELPER_SOURCE_ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-update-verify.js" ]; then
  HELPER_SOURCE_ROOT="$HOME/.claude/forgeflow"
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-update-verify.js" ]; then
  echo "Update verification helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-update-verify."
  exit 1
fi
SAFE_ARGS=(--root "${HELPER_SOURCE_ROOT}" --home "$HOME/.claude")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-update-verify"; exit 2 ;;
  esac
done
"${HELPER_DIR}/render-update-verify.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is read-only.
- [ ] Output includes ready, restart, or repair status.
- [ ] Output includes a copy-pastable next command and separate reason.
</success_criteria>
