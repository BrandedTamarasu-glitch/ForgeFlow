---
name: forgeflow-context-retention
description: Review local Forgeflow context artifact freshness and retention without mutating files
argument-hint: "[--max-history <n>] [--stale-days <n>] [--preview-cleanup] [--json]"
allowed-tools:
  - Bash
---
<objective>
Show a read-only retention and freshness review for local Forgeflow context artifacts, including latest insight files, agent packets, broad context artifacts, and history files.
</objective>

<context>
This command is advisory and local. It does not delete, archive, compact, refresh, or mutate artifacts.
</context>

<process>
Validate `$ARGUMENTS`. Only `--max-history <n>`, `--stale-days <n>`, `--preview-cleanup`, and `--json` are supported.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-context-retention.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-context-retention.js" ]; then
  echo "Context retention helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-context-retention."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
i=0
while [ "$i" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$i]}"
  case "$arg" in
    --max-history|--stale-days)
      next_index=$((i + 1))
      value="${USER_ARGS[$next_index]:-}"
      if [[ ! "$value" =~ ^[0-9]+$ ]]; then
        echo "Unsupported value for ${arg}; expected a positive integer."
        exit 2
      fi
      SAFE_ARGS+=("$arg" "$value")
      i=$((i + 2))
      ;;
    --preview-cleanup|--json)
      SAFE_ARGS+=("$arg")
      i=$((i + 1))
      ;;
    "")
      i=$((i + 1))
      ;;
    *)
      echo "Unsupported arguments for /forgeflow-context-retention"
      exit 2
      ;;
  esac
done
"${HELPER_DIR}/render-context-retention.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is read-only and advisory.
- [ ] Stale or oversized context artifacts have clear manual recommendations.
- [ ] History files over the retention target are reported without deletion.
</success_criteria>
