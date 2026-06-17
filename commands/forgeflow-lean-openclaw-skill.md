---
name: forgeflow-lean-openclaw-skill
description: Check or regenerate the committed OpenClaw lean skill
argument-hint: "[--write] [--json]"
allowed-tools:
  - Bash
---
<objective>
Check that the committed OpenClaw lean skill matches the canonical generated lean rule text, or regenerate it with `--write`.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments, `--write`, and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-openclaw-skill.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-openclaw-skill.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-openclaw-skill.js" ]; then
  echo "Lean OpenClaw skill helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-openclaw-skill."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "") ;;
    --write|--json) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-lean-openclaw-skill"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-openclaw-skill.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output reports whether the OpenClaw skill is current.
- [ ] The command does not install adapters, commit, push, or call the network.
</success_criteria>
