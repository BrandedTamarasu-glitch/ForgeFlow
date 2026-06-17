---
name: forgeflow-lean-skills
description: Check or regenerate committed Forgeflow lean skill packages
argument-hint: "[--write] [--json]"
allowed-tools:
  - Bash
---
<objective>
Check that committed `skills/forgeflow-lean*/SKILL.md` packages match the canonical lean rule text, or regenerate them with `--write`.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments, `--write`, `--json`, or both.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-skills.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-skills.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-skills.js" ]; then
  echo "Lean skills helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-skills."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "") ;;
    --write|--json) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-lean-skills"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-skills.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output reports each committed lean skill package as current, missing, or drifted.
- [ ] `--write` writes only committed `skills/forgeflow-lean*/SKILL.md` files.
- [ ] The command does not install skills, edit host settings, commit, push, or call the network.
</success_criteria>
