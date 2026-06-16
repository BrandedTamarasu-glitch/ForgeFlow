---
name: forgeflow-lean-rule-canary
description: Check load-bearing lean rule invariants across local rule surfaces
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Check that safety and correctness carve-outs remain present across the canonical lean rule, session text, docs, and portability target surfaces.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-rule-canary.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-rule-canary.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-rule-canary.js" ]; then
  echo "Lean rule canary helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-rule-canary."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "" ) ;;
    --json) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-lean-rule-canary"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-rule-canary.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output reports pass/fail for load-bearing lean rule invariants.
- [ ] The command is read-only and does not rewrite docs or adapters.
</success_criteria>
