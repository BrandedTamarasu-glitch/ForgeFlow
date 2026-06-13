---
name: forgeflow-lean-benchmark
description: Compare local baseline and lean-guided aggregate delivery metrics
argument-hint: "[--baseline <json>] [--current <json>] [--write] [--json]"
allowed-tools:
  - Bash
---
<objective>
Render a read-only local benchmark comparing baseline and lean-guided aggregate delivery metrics: files, lines, validation signals, review findings, prose warnings, ceiling captures, follow-up signals, and context-token savings.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments, `--json`, `--write`, `--baseline <json>`, and `--current <json>`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-benchmark.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-benchmark.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-benchmark.js" ]; then
  echo "Lean benchmark helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-benchmark."
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
    --baseline|--current)
      next_i=$((i + 1))
      value="${USER_ARGS[$next_i]:-}"
      if [ -z "$value" ] || [[ "$value" == --* ]]; then echo "Missing value for $arg"; exit 2; fi
      SAFE_ARGS+=("$arg" "$value")
      i=$next_i
      ;;
    *) echo "Unsupported arguments for /forgeflow-lean-benchmark"; exit 2 ;;
  esac
  i=$((i + 1))
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-benchmark.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is local-only and aggregate-first.
- [ ] Output compares baseline and current aggregate metrics without raw code snippets.
- [ ] `--write` writes only `.forgeflow/<project>/context/lean-benchmark.md` and `.json`.
- [ ] Output makes no performance claim unless sample size/evidence is visible.
- [ ] The command does not run implementations, spawn agents, edit source files, commit, push, or export telemetry.
</success_criteria>
