---
name: forgeflow-lean-adapter-smoke
description: Smoke-test committed lean adapter manifests and plugin wrappers
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Run local structural smoke checks for committed lean adapter manifests and plugin wrappers without launching host applications.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments or `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-adapter-smoke.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-adapter-smoke.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-adapter-smoke.js" ]; then
  echo "Lean adapter smoke helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-adapter-smoke."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "") ;;
    --json) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-lean-adapter-smoke"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-adapter-smoke.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output reports adapter smoke status.
- [ ] The command does not launch hosts, install adapters, edit settings, commit, push, or call the network.
</success_criteria>
