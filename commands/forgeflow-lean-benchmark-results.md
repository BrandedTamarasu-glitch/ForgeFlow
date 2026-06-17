---
name: forgeflow-lean-benchmark-results
description: Validate aggregate lean benchmark result evidence
argument-hint: "--results <json> [--json]"
allowed-tools:
  - Bash
---
<objective>
Validate that aggregate lean benchmark results have enough metadata, correctness evidence, and caveats to support performance claims.
</objective>

<process>
Validate `$ARGUMENTS`. Require `--results <json>` and optionally accept `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-benchmark-results.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-benchmark-results.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-benchmark-results.js" ]; then
  echo "Lean benchmark results helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-benchmark-results."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}")
seen_results=0
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
i=0
while [ "$i" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$i]}"
  case "$arg" in
    "") ;;
    --json) SAFE_ARGS+=("$arg") ;;
    --results)
      next_i=$((i + 1))
      value="${USER_ARGS[$next_i]:-}"
      if [ -z "$value" ] || [[ "$value" == --* ]]; then echo "Missing --results value"; exit 2; fi
      SAFE_ARGS+=("--results" "$value")
      seen_results=1
      i=$next_i
      ;;
    *) echo "Unsupported arguments for /forgeflow-lean-benchmark-results"; exit 2 ;;
  esac
  i=$((i + 1))
done
if [ "$seen_results" -ne 1 ]; then echo "Missing required --results <json>"; exit 2; fi
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-benchmark-results.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output reports whether benchmark evidence can support aggregate claims.
- [ ] The command does not run models, install dependencies, commit, push, or call the network.
</success_criteria>
