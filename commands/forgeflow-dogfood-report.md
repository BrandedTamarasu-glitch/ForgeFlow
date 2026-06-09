---
name: forgeflow-dogfood-report
description: Render a read-only dogfood report for automation promotion readiness
argument-hint: "[--json] [--write]"
allowed-tools:
  - Bash
---
<objective>
Render a read-only dogfood report that evaluates whether Phase 8-11 context-intelligence automation evidence is ready to keep, refine, or consider for narrow opt-in promotion.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments, `--json`, `--write`, or both.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-dogfood-report.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-dogfood-report.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-dogfood-report.js" ]; then
  echo "Dogfood report helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-dogfood-report."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "") ;;
    --json|--write) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-dogfood-report"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-dogfood-report.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output summarizes Phase 8-11 evidence, context-pack signals, invalid artifacts, promotion decision, and next actions.
- [ ] Default behavior is read-only.
- [ ] `--write` writes only local `.forgeflow/<project>/context/dogfood-report.md` and `.json` artifacts.
- [ ] Output does not patch files, call GitHub, push, publish, batch fixes, or automatically promote deferred automation.
</success_criteria>
