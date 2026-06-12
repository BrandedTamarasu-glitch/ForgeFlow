---
name: forgeflow-lean-report
description: Render local lean-delivery metrics and dogfood readiness
argument-hint: "[--json] [--write]"
allowed-tools:
  - Bash
---
<objective>
Render a read-only local report for lean-guided work: files and lines touched, reuse and avoid-first signals, validation coverage, review churn hints, prose-budget warnings, context-token savings, and whether simplification ceilings were captured.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments, `--json`, `--write`, or both.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-report.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-report.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-report.js" ]; then
  echo "Lean report helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-report."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "") ;;
    --json|--write) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-lean-report"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-report.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is local-only and aggregate-first.
- [ ] Output summarizes lean decision, implementation-note ceiling capture, review/prose warnings, diff size, context-token savings, and telemetry quality.
- [ ] `--write` writes only `.forgeflow/<project>/context/lean-report.md` and `.json`.
- [ ] Output does not include raw code snippets, export telemetry, or change workflow policy automatically.
</success_criteria>
