---
name: forgeflow-research-divergence-eval
description: Preview the deterministic research comparison pack or summarize captured evidence
argument-hint: "[--results <json>] [--json]"
allowed-tools:
  - Bash
---
<objective>
Preview Forgeflow's built-in eight-task baseline-versus-divergent research evaluation, or summarize explicitly supplied evidence. Both modes are deterministic and read-only. They never invoke models, agents, or the network.
</objective>

<process>
Accept only no arguments, `--json`, or one repository-relative `--results <json>` with optional `--json`. Without `--results`, render the built-in task pack. With it, summarize that captured evidence.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/render-research-divergence-eval.js" ] && [ -f "$HOME/.claude/forgeflow/scripts/forgeflow/render-research-divergence-eval.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
for helper in render-research-divergence-eval.js render-research-divergence-eval-results.js; do
  if [ ! -f "${HELPER_DIR}/${helper}" ]; then
    echo "Research divergence eval helpers are not installed. Run /update-forgeflow --repair, then retry."
    exit 1
  fi
done
SAFE_ARGS=()
RESULTS=""
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
i=0
while [ "$i" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$i]}"
  case "$arg" in
    --json) SAFE_ARGS+=("$arg") ;;
    --results)
      next_i=$((i + 1))
      value="${USER_ARGS[$next_i]:-}"
      if [ -z "$value" ] || [ -n "$RESULTS" ] || [[ "$value" == --* ]] || [[ "$value" == *".."* ]] || [[ "$value" == /* ]] || [[ "$value" == *";"* ]] || [[ "$value" == *"|"* ]] || [[ "$value" == *"&"* ]] || [[ "$value" == *"<"* ]] || [[ "$value" == *">"* ]]; then
        echo "Invalid --results path"
        exit 2
      fi
      RESULTS="${ROOT}/${value}"
      i=$next_i
      ;;
    *) echo "Unsupported arguments for /forgeflow-research-divergence-eval"; exit 2 ;;
  esac
  i=$((i + 1))
done
cd "${ROOT}"
if [ -n "$RESULTS" ]; then
  env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-research-divergence-eval-results.js" --evidence "$RESULTS" --root "$ROOT" "${SAFE_ARGS[@]}"
else
  env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-research-divergence-eval.js" "${SAFE_ARGS[@]}"
fi
```
</process>

<evidence_boundary>
- The preview proves only the shape of the built-in comparison pack.
- A results summary reports supplied evidence. It does not prove model execution, independent or human validation, general superiority, or transfer beyond the eight included tasks.
- Claims about quality, cost, latency, or reliability require representative captured results and should disclose sample size, scorer provenance, failures, and known limitations.
</evidence_boundary>

<success_criteria>
- [ ] No files, memory, telemetry, models, agents, dependencies, or network are touched.
- [ ] Baseline and divergent evidence remain distinguishable, with unsupported claims called out.
</success_criteria>
