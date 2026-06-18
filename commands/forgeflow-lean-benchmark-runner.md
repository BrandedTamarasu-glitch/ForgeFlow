---
name: forgeflow-lean-benchmark-runner
description: Render an opt-in lean benchmark runner scaffold
argument-hint: "[--write] [--run] [--json]"
allowed-tools:
  - Bash
---
<objective>
Render a reproducible benchmark runner scaffold for lean guidance comparisons without running model calls by default.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments, `--write`, `--run`, and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-benchmark-runner.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-benchmark-runner.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-benchmark-runner.js" ]; then
  echo "Lean benchmark runner helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-benchmark-runner."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "") ;;
    --write|--run|--json) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-lean-benchmark-runner"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-benchmark-runner.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output reports benchmark tasks, arms, and opt-in run commands.
- [ ] The command does not call models, install dependencies, commit, push, or call the network by default.
- [ ] `--run` requires `FORGEFLOW_BENCHMARK_ALLOW_NETWORK=1` and an existing promptfoo executable, then imports raw output when available.
</success_criteria>
