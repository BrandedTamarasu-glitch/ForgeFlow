---
name: forgeflow-context-advisor
description: Show context budget, savings, topology coverage, and advisory trim recommendations.
argument-hint: "[--record] [--json] [--max-compact-tokens N] [--max-kind kind=N]"
allowed-tools:
  - Bash
---
<objective>
Print Forgeflow context-advisor guidance for the current repository: compact-token budget status, savings, topology coverage, trend deltas, and proof-preserving trim recommendations.
</objective>

<context>
$ARGUMENTS:
- `--record` - append this advisory snapshot to local `.forgeflow/context-advisor-history.jsonl`
- `--json` - emit machine-readable output
- `--max-compact-tokens N` - override the default total compact-token limit
- `--max-kind kind=N` - override one per-kind compact-token limit
</context>

<process>
Validate `$ARGUMENTS`. Accept only `--record`, `--json`, `--max-compact-tokens N`, and `--max-kind kind=N`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/advise-context.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -f "${HELPER_DIR}/advise-context.js" ]; then
  echo "Context advisor helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-context-advisor."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}/.forgeflow")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
i=0
while [ "$i" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$i]}"
  case "$arg" in
    --record) SAFE_ARGS+=(--record) ;;
    --json) SAFE_ARGS+=(--json) ;;
    --max-compact-tokens)
      i=$((i + 1))
      value="${USER_ARGS[$i]:-}"
      case "$value" in
        ''|*[!0-9]*) echo "Invalid --max-compact-tokens value"; exit 2 ;;
        *) SAFE_ARGS+=(--max-compact-tokens "$value") ;;
      esac
      ;;
    --max-kind)
      i=$((i + 1))
      value="${USER_ARGS[$i]:-}"
      kind="${value%%=*}"
      limit="${value#*=}"
      if [ "$value" = "$kind" ] || [ -z "$kind" ] || [ -z "$limit" ]; then
        echo "Invalid --max-kind value. Expected kind=N."
        exit 2
      fi
      case "$kind" in
        *[!A-Za-z0-9_-]*) echo "Invalid --max-kind value. Expected kind=N."; exit 2 ;;
      esac
      case "$limit" in
        *[!0-9]*) echo "Invalid --max-kind value. Expected kind=N."; exit 2 ;;
      esac
      SAFE_ARGS+=(--max-kind "$value")
      ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-context-advisor"; exit 2 ;;
  esac
  i=$((i + 1))
done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/advise-context.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output reports budget, savings, topology coverage, and advisor recommendations
- [ ] `--record` writes only local advisory history under `.forgeflow/`
- [ ] The command does not trim packets, edit source files, delete artifacts, spawn agents, commit, or push
</success_criteria>
