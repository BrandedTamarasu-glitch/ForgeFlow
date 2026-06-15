---
name: forgeflow-lean-lab
description: Compare lean guidance modes across repeatable local task-pack results
argument-hint: "[--task-pack <json>] [--results <json>] [--write] [--json]"
allowed-tools:
  - Bash
---
<objective>
Render a read-only local lean lab comparing baseline, balanced, strict, and ultra guidance on repeatable local task-pack results. It shows sample size, validation gates, LOC, files touched, review churn, context tokens, optional cost/latency, and follow-up fixes without raw private snippets or hosted telemetry.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments, `--json`, `--write`, `--task-pack <json>`, and `--results <json>`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-lab.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-lab.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-lab.js" ]; then
  echo "Lean lab helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-lab."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
i=0
while [ "$i" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$i]}"
  case "$arg" in
    "") ;;
    --json|--write) SAFE_ARGS+=("$arg") ;;
    --task-pack|--results)
      next_i=$((i + 1))
      value="${USER_ARGS[$next_i]:-}"
      if [ -z "$value" ] || [[ "$value" == --* ]]; then echo "Missing value for $arg"; exit 2; fi
      SAFE_ARGS+=("$arg" "$value")
      i=$next_i
      ;;
    *) echo "Unsupported arguments for /forgeflow-lean-lab"; exit 2 ;;
  esac
  i=$((i + 1))
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-lab.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is local-only and aggregate-first.
- [ ] Output compares baseline, balanced, strict, and ultra modes from local task-pack results.
- [ ] Output shows visible sample size and validation gates before ranking modes.
- [ ] `--write` writes only `.forgeflow/<project>/context/lean-lab.md` and `.json`.
- [ ] The command does not run implementations, spawn agents, call APIs, edit source files, commit, push, or export telemetry.
</success_criteria>
