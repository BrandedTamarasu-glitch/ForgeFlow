---
name: forgeflow-lean-host-cli-probes
description: Inspect local host CLI availability for manual lean adapter smoke probes
argument-hint: "[--evidence <json>] [--json]"
allowed-tools:
  - Bash
---
<objective>
Report which optional host CLIs are available on PATH and print manual lean adapter probe commands without launching host applications.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments, `--json`, and `--evidence <json>`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-host-cli-probes.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-host-cli-probes.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-host-cli-probes.js" ]; then
  echo "Lean host CLI probe helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-host-cli-probes."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for ((i = 0; i < ${#USER_ARGS[@]}; i++)); do
  arg="${USER_ARGS[$i]}"
  case "$arg" in
    "") ;;
    --json) SAFE_ARGS+=("$arg") ;;
    --evidence)
      next_i=$((i + 1))
      file="${USER_ARGS[$next_i]:-}"
      if [ -z "$file" ] || [[ "$file" == --* ]]; then
        echo "Missing evidence file for /forgeflow-lean-host-cli-probes"
        exit 2
      fi
      SAFE_ARGS+=(--evidence "$file")
      i=$next_i
      ;;
    *) echo "Unsupported arguments for /forgeflow-lean-host-cli-probes"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-host-cli-probes.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output lists optional host CLI availability and manual probe commands.
- [ ] Optional evidence marks manually checked probes without launching host CLIs.
- [ ] The command does not launch host CLIs, install adapters, edit settings, commit, push, or call the network.
</success_criteria>
