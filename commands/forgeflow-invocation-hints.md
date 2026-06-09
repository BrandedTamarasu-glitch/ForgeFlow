---
name: forgeflow-invocation-hints
description: Render advisory runtime entrypoint and invocation hints from local Forgeflow evidence
argument-hint: "[--json] [--write]"
allowed-tools:
  - Bash
---
<objective>
Render read-only runtime entrypoint and invocation hints from package metadata, config files, topology, architecture evidence, and route-like static conventions.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments, `--json`, `--write`, or both.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-invocation-hints.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-invocation-hints.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-invocation-hints.js" ]; then
  echo "Invocation hints helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-invocation-hints."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "") ;;
    --json|--write) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-invocation-hints"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-invocation-hints.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output includes package scripts, entry fields, bins, topology entrypoints, config hints, gaps, and next action.
- [ ] Default behavior is read-only.
- [ ] `--write` writes only local `.forgeflow/<project>/context/invocation-hints.md` and `.json` artifacts.
- [ ] Output is advisory static evidence, not executed runtime proof or a full call graph.
</success_criteria>
