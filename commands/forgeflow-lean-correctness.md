---
name: forgeflow-lean-correctness
description: Run executable local lean correctness canaries
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Run deterministic executable correctness canaries that accept known-good snippets and reject known lazy-wrong snippets.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments or `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-correctness.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-correctness.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-correctness.js" ]; then
  echo "Lean correctness helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-correctness."
  exit 1
fi
SAFE_ARGS=()
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "") ;;
    --json) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-lean-correctness"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-correctness.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output reports executable correctness selftest status.
- [ ] The command does not install dependencies, call models, edit files, commit, push, or call the network.
</success_criteria>
