---
name: forgeflow-lean-behavior
description: Evaluate generated output for lean behavior probes
argument-hint: "[--file <path> | --text <text>] [--requested-explanation] [--json]"
allowed-tools:
  - Bash
---
<objective>
Evaluate an output file or inline text for lean behavior probes: calibration boundaries, requested explanation preservation, one runnable check for non-trivial logic, no new dependency without justification, stdlib/native-first evidence, and explicit requirement preservation. This command is read-only and advisory.
</objective>

<process>
Validate `$ARGUMENTS`. Accept `--json`, `--requested-explanation`, one `--file <safe path>`, and one `--text <single shell word or quoted text>`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-behavior-eval.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-behavior-eval.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-behavior-eval.js" ]; then
  echo "Lean behavior helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-behavior."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
i=0
while [ "$i" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$i]}"
  case "$arg" in
    "") ;;
    --json|--requested-explanation) SAFE_ARGS+=("$arg") ;;
    --file)
      next_i=$((i + 1))
      value="${USER_ARGS[$next_i]:-}"
      if [ -z "$value" ] || [[ "$value" == --* ]] || [[ "$value" == *".."* ]] || [[ "$value" == /* ]] || [[ "$value" == *";"* ]] || [[ "$value" == *"|"* ]] || [[ "$value" == *"&"* ]] || [[ "$value" == *"<"* ]] || [[ "$value" == *">"* ]]; then
        echo "Invalid --file for /forgeflow-lean-behavior"
        exit 2
      fi
      SAFE_ARGS+=(--file "${ROOT}/${value}")
      i=$next_i
      ;;
    --text)
      next_i=$((i + 1))
      value="${USER_ARGS[$next_i]:-}"
      if [ -z "$value" ] || [[ "$value" == --* ]]; then
        echo "Missing --text for /forgeflow-lean-behavior"
        exit 2
      fi
      SAFE_ARGS+=(--text "$value")
      i=$next_i
      ;;
    *) echo "Unsupported arguments for /forgeflow-lean-behavior"; exit 2 ;;
  esac
  i=$((i + 1))
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-behavior-eval.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output reports pass/warn/fail for each lean behavior probe.
- [ ] The command does not run generated code, call models, edit files, mutate context, or prove functional correctness.
</success_criteria>
