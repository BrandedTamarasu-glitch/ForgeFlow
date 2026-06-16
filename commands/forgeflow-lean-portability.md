---
name: forgeflow-lean-portability
description: Generate or check portable Forgeflow lean rule copies
argument-hint: "[--profile lite|off|balanced|strict|ultra] [--write] [--json]"
allowed-tools:
  - Bash
---
<objective>
Generate or check a compact Forgeflow lean portability pack for generic agent hosts. By default this is read-only; `--write` writes only under `.forgeflow/<project>/lean-portability/`.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments, `--json`, `--write`, and `--profile lite|off|balanced|strict|ultra`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-portability-pack.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-portability-pack.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-portability-pack.js" ]; then
  echo "Lean portability helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-portability."
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
        *) echo "Unsupported lean profile for /forgeflow-lean-portability"; exit 2 ;;
      esac
      ;;
    *) echo "Unsupported arguments for /forgeflow-lean-portability"; exit 2 ;;
  esac
  i=$((i + 1))
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-portability-pack.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output lists target rule-copy files and whether each is missing, current, drifted, or written.
- [ ] `--write` writes only `.forgeflow/<project>/lean-portability/`.
- [ ] The command does not edit global agent settings, install adapters, commit, push, or call the network.
</success_criteria>
