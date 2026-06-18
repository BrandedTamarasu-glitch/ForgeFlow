---
name: forgeflow-lean-prime
description: Show the first-run path to make lean guidance ready for context injection
argument-hint: "[--task <text>] [--write-plan] [--json]"
allowed-tools:
  - Bash
---
<objective>
Show one first-run checklist for lean guidance: mode, decision evidence, report evidence, telemetry quality, context-injection eligibility, and the next concrete command. Optionally write a local plan artifact.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments, `--json`, `--write-plan`, and `--task <text>`.

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
i=0
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
while [ "$i" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$i]}"
  case "$arg" in
    "") ;;
    --json|--write-plan) SAFE_ARGS+=("$arg") ;;
    --task)
      next_i=$((i + 1))
      task="${USER_ARGS[$next_i]:-}"
      if [ -z "$task" ] || [[ "$task" == --* ]]; then
        echo "Missing task text for /forgeflow-lean-prime"
        exit 2
      fi
      SAFE_ARGS+=("--task" "$task")
      i=$next_i
      ;;
    *) echo "Unsupported arguments for /forgeflow-lean-prime"; exit 2 ;;
  esac
  i=$((i + 1))
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-prime.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output shows mode, decision, report, telemetry, and context-injection steps.
- [ ] Output gives one next command to clear the first blocker.
- [ ] `--write-plan` writes only `.forgeflow/<project>/context/lean-prime-plan.md` and `.json`.
- [ ] The command does not edit code, settings, routing, install hooks, commit, push, or call the network.
</success_criteria>
