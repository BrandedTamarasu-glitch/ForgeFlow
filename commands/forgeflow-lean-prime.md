---
name: forgeflow-lean-prime
description: Show the first-run path to make lean guidance ready for context injection
argument-hint: "[--task <text>] [--prime-task <text>] [--write-plan] [--write-report] [--json]"
allowed-tools:
  - Bash
---
<objective>
Show one first-run checklist for lean guidance: mode, decision evidence, report evidence, telemetry quality, context-injection eligibility, and the next concrete command. Optionally write a local plan artifact.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments, `--json`, `--write-plan`, `--write-report`, `--task <text>`, and `--prime-task <text>`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-prime.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-prime.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-prime.js" ]; then
  echo "Lean prime helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-prime."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
ARGS="${ARGUMENTS:-}"
case "$ARGS" in
  *--json*) SAFE_ARGS+=(--json); ARGS="${ARGS/--json/}" ;;
esac
case "$ARGS" in
  *--write-plan*) SAFE_ARGS+=(--write-plan); ARGS="${ARGS/--write-plan/}" ;;
esac
case "$ARGS" in
  *--write-report*) SAFE_ARGS+=(--write-report); ARGS="${ARGS/--write-report/}" ;;
esac
ARGS="${ARGS#"${ARGS%%[![:space:]]*}"}"
ARGS="${ARGS%"${ARGS##*[![:space:]]}"}"
case "$ARGS" in
  "") ;;
  --task\ *)
    task="${ARGS#--task }"
    [ -n "$task" ] || { echo "Missing task text for /forgeflow-lean-prime"; exit 2; }
    SAFE_ARGS+=(--task "$task")
    ;;
  --prime-task\ *)
    task="${ARGS#--prime-task }"
    [ -n "$task" ] || { echo "Missing task text for /forgeflow-lean-prime"; exit 2; }
    SAFE_ARGS+=(--prime-task "$task")
    ;;
  *) echo "Unsupported arguments for /forgeflow-lean-prime"; exit 2 ;;
esac
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-prime.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output shows mode, decision, report, telemetry, and context-injection steps.
- [ ] Output gives one next command to clear the first blocker.
- [ ] `--write-plan` writes only `.forgeflow/<project>/context/lean-prime-plan.md` and `.json`.
- [ ] `--prime-task` writes only `.forgeflow/<project>/context/lean-decision.*` and `lean-prime-plan.*`.
- [ ] `--write-report` writes only `.forgeflow/<project>/context/lean-report.md` and `.json`.
- [ ] The command does not edit code, settings, routing, install hooks, commit, push, or call the network.
</success_criteria>
