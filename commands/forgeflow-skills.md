---
name: forgeflow-skills
description: Check or regenerate committed core Forgeflow skill packages
argument-hint: "[--write] [--json]"
allowed-tools:
  - Bash
---
<objective>
Check that committed `skills/forgeflow-*/SKILL.md` packages for core workflows match the canonical generator, or regenerate them with `--write`.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments, `--write`, `--json`, or both.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-forgeflow-skills.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-forgeflow-skills.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-forgeflow-skills.js" ]; then
  echo "Forgeflow skills helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-skills."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "") ;;
    --write|--json) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-skills"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-forgeflow-skills.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output reports each committed core Forgeflow skill package as current, missing, or drifted.
- [ ] `--write` writes only committed `skills/forgeflow-*/SKILL.md` files.
- [ ] The command does not install skills, edit host settings, commit, push, or call the network.
</success_criteria>
