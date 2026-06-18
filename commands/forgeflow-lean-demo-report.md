---
name: forgeflow-lean-demo-report
description: Summarize local lean readiness, host coverage, skills, and benchmark scaffold for demos
argument-hint: "[--write] [--json]"
allowed-tools:
  - Bash
---
<objective>
Render a concise lean demo readiness report from local Forgeflow artifacts.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments, `--write`, and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-demo-report.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-demo-report.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-demo-report.js" ]; then
  echo "Lean demo report helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-demo-report."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "") ;;
    --write|--json) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-lean-demo-report"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-demo-report.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output summarizes Lean Prime, host adapters, command parity, skills, and benchmark readiness.
- [ ] With `--write`, artifacts are written only under `.forgeflow/<project>/context/`.
- [ ] The command does not run model benchmarks, launch host CLIs, install adapters, commit, push, or call the network.
</success_criteria>
