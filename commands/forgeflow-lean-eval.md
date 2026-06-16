---
name: forgeflow-lean-eval
description: Run the local deterministic Forgeflow lean eval pack
argument-hint: "[--cases <json>] [--json]"
allowed-tools:
  - Bash
---
<objective>
Run local deterministic lean eval fixtures for calibration boundaries, requested explanation preservation, one runnable check, dependency avoidance, stdlib/native/reuse evidence, and explicit requirement preservation. This command never calls models or the network.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments, `--json`, and one safe `--cases <json>` path.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-eval-pack.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-eval-pack.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-eval-pack.js" ]; then
  echo "Lean eval helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-eval."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
i=0
while [ "$i" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$i]}"
  case "$arg" in
    "") ;;
    --json) SAFE_ARGS+=("$arg") ;;
    --cases)
      next_i=$((i + 1))
      value="${USER_ARGS[$next_i]:-}"
      if [ -z "$value" ] || [[ "$value" == --* ]] || [[ "$value" == *".."* ]] || [[ "$value" == /* ]] || [[ "$value" == *";"* ]] || [[ "$value" == *"|"* ]] || [[ "$value" == *"&"* ]] || [[ "$value" == *"<"* ]] || [[ "$value" == *">"* ]]; then
        echo "Invalid --cases for /forgeflow-lean-eval"
        exit 2
      fi
      SAFE_ARGS+=(--cases "${ROOT}/${value}")
      i=$next_i
      ;;
    *) echo "Unsupported arguments for /forgeflow-lean-eval"; exit 2 ;;
  esac
  i=$((i + 1))
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-eval-pack.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output reports pass/fail for local lean eval cases.
- [ ] The command does not call models, run generated code, install dependencies, mutate context, commit, push, or call the network.
</success_criteria>
