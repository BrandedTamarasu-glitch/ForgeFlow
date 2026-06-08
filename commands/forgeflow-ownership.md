---
name: forgeflow-ownership
description: Render advisory owner-surface recommendations from local Forgeflow evidence
argument-hint: "[--json] [--write]"
allowed-tools:
  - Bash
---
<objective>
Render a read-only ownership recommendation map from local topology, project operating model, architecture evidence, and optional CODEOWNERS content.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments, `--json`, `--write`, or both.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-ownership-map.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-ownership-map.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-ownership-map.js" ]; then
  echo "Ownership map helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-ownership."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "") ;;
    --json|--write) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-ownership"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-ownership-map.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output includes CODEOWNERS state, owner surfaces, high-care files, coverage gaps, and next action.
- [ ] Default behavior is read-only.
- [ ] `--write` writes only local `.forgeflow/<project>/context/ownership-map.md` and `.json` artifacts.
- [ ] Output is advisory routing guidance, not ownership enforcement or permission proof.
</success_criteria>
