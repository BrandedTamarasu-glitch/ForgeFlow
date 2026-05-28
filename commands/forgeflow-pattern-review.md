---
name: forgeflow-pattern-review
description: Review cross-project pattern promotion candidates without mutating pattern files
argument-hint: "[--period week|month|all] [--min-projects N] [--min-occurrences N] [--json]"
allowed-tools:
  - Bash
---
<objective>
Show manual pattern promotion candidates from local Forgeflow learning sources with a redaction checklist and explicit no-auto-promotion boundary.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--period`, `--min-projects`, `--min-occurrences`, and `--json`; reject unknown flags and shell metacharacters.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-pattern-review.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-pattern-review.js" ]; then
  echo "Pattern review helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-pattern-review."
  exit 1
fi
SAFE_ARGS=(--root "$HOME" --patterns-dir "${ROOT}/forgeflow-patterns")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for ((i=0; i<${#USER_ARGS[@]}; i++)); do
  arg="${USER_ARGS[$i]}"
  case "$arg" in
    --period)
      value="${USER_ARGS[$((i+1))]:-}"
      if [ -z "$value" ] || [[ "$value" == --* ]]; then echo "Missing value for $arg"; exit 2; fi
      case "$value" in week|month|all) ;; *) echo "Invalid value for --period"; exit 2 ;; esac
      SAFE_ARGS+=("$arg" "$value")
      i=$((i+1))
      ;;
    --min-projects|--min-occurrences)
      value="${USER_ARGS[$((i+1))]:-}"
      if [ -z "$value" ] || [[ "$value" == --* ]]; then echo "Missing value for $arg"; exit 2; fi
      case "$value" in ''|*[!0-9]*|0) echo "Invalid numeric value for $arg"; exit 2 ;; esac
      SAFE_ARGS+=("$arg" "$value")
      i=$((i+1))
      ;;
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-pattern-review"; exit 2 ;;
  esac
done
"${HELPER_DIR}/render-pattern-review.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output is dry-run only.
- [ ] Promotion remains manual and public-safe.
</success_criteria>
