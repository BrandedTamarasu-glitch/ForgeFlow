---
name: forgeflow-architecture
description: Render local advisory architecture docs from Forgeflow topology and project intelligence
argument-hint: "[--json] [--write]"
allowed-tools:
  - Bash
---
<objective>
Render advisory architecture documentation from existing Forgeflow code topology, project intelligence, operating model, and learning artifacts.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments, `--json`, `--write`, or both.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-architecture-docs.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-architecture-docs.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-architecture-docs.js" ]; then
  echo "Architecture docs helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-architecture."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "") ;;
    --json|--write) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-architecture"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-architecture-docs.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output includes evidence sources, domains, entrypoint hints, hotspots, high-care files, risk zones, validation norms, known gaps, and next action.
- [ ] Default behavior is read-only.
- [ ] `--write` writes only local `.forgeflow/<project>/context/architecture.md` and `.json` artifacts.
- [ ] Output is advisory static evidence, not runtime proof.
</success_criteria>
