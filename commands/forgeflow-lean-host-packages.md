---
name: forgeflow-lean-host-packages
description: Render local host package guidance for Forgeflow lean adapters
argument-hint: "[--profile lite|off|balanced|strict|ultra] [--write] [--json]"
allowed-tools:
  - Bash
---
<objective>
Render a host package manifest showing where each generated lean adapter belongs. By default this is read-only; `--write` stores only `.forgeflow/<project>/lean-packages/manifest.json` and `README.md`.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments, `--json`, `--write`, and `--profile lite|off|balanced|strict|ultra`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-host-packages.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-host-packages.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-host-packages.js" ]; then
  echo "Lean host packages helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-host-packages."
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
    --profile)
      next_i=$((i + 1))
      profile="${USER_ARGS[$next_i]:-}"
      case "$profile" in
        lite|off|balanced|strict|ultra) SAFE_ARGS+=("--profile" "$profile"); i=$next_i ;;
        *) echo "Unsupported lean profile for /forgeflow-lean-host-packages"; exit 2 ;;
      esac
      ;;
    *) echo "Unsupported arguments for /forgeflow-lean-host-packages"; exit 2 ;;
  esac
  i=$((i + 1))
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-host-packages.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output lists plugin, adapter, instruction, and skill host package targets.
- [ ] `--write` writes only `.forgeflow/<project>/lean-packages/`.
- [ ] The command does not install adapters, edit host settings, commit, push, or call the network.
</success_criteria>
