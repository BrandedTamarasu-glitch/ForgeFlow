---
name: forgeflow-first-run
description: Print the net-new user first-run guide for verifying Forgeflow and starting one bounded work item
argument-hint: "[--runtime claude-code|codex] [--project-name <name>] [--json]"
allowed-tools:
  - Bash
---
<objective>
Print a compact first-run guide for a new Forgeflow user. It verifies install health, orients to project guidance and project-map evolution, checks user profile readiness, inspects agent insight injection, and starts one bounded work item.
</objective>

<context>
$ARGUMENTS:
- `--runtime claude-code|codex` - output slash-command or checkout-helper examples.
- `--project-name <name>` - label the guide for a project.
- `--json` - structured output.
</context>

<process>
Before Bash, validate `$ARGUMENTS`. Accept only `--runtime claude-code|codex`, `--project-name <plain text>`, and `--json`. Reject shell metacharacters and unexpected flags.

Resolve helpers from the checkout first, then installed runtime:

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/render-first-run-guide.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -f "${HELPER_DIR}/render-first-run-guide.js" ]; then
  echo "First-run guide helper is not installed. Run /update-forgeflow, then retry /forgeflow-first-run."
  exit 1
fi
SAFE_ARGS=()
RAW_ARGS="${ARGUMENTS:-}"
PROJECT_NAME_ARG=""
PROJECT_NAME_SEGMENT=""
if [[ "$RAW_ARGS" =~ (^|[[:space:]])--project-name[[:space:]]+\"([^\"]+)\" ]]; then
  PROJECT_NAME_SEGMENT="${BASH_REMATCH[0]}"
  PROJECT_NAME_ARG="${BASH_REMATCH[2]}"
elif [[ "$RAW_ARGS" =~ (^|[[:space:]])--project-name[[:space:]]+\'([^\']+)\' ]]; then
  PROJECT_NAME_SEGMENT="${BASH_REMATCH[0]}"
  PROJECT_NAME_ARG="${BASH_REMATCH[2]}"
elif [[ "$RAW_ARGS" =~ (^|[[:space:]])--project-name[[:space:]]+([^[:space:]]+) ]]; then
  PROJECT_NAME_SEGMENT="${BASH_REMATCH[0]}"
  PROJECT_NAME_ARG="${BASH_REMATCH[2]}"
fi
if [ -n "$PROJECT_NAME_ARG" ]; then
  if [[ "$PROJECT_NAME_ARG" == --* ]] || [[ "$PROJECT_NAME_ARG" =~ [\;\&\|\>\<\`\$\\] ]]; then
    echo "Invalid --project-name for /forgeflow-first-run"
    exit 2
  fi
  SAFE_ARGS+=(--project-name "$PROJECT_NAME_ARG")
  RAW_ARGS="${RAW_ARGS/$PROJECT_NAME_SEGMENT/ }"
fi
read -r -a USER_ARGS <<< "$RAW_ARGS"
i=0
while [ "$i" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$i]}"
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    --runtime)
      next_index=$((i + 1))
      value="${USER_ARGS[$next_index]:-}"
      case "$value" in
        claude-code|codex) SAFE_ARGS+=(--runtime "$value") ;;
        *) echo "Invalid --runtime for /forgeflow-first-run"; exit 2 ;;
      esac
      i=$next_index
      ;;
    --project-name) echo "Invalid --project-name for /forgeflow-first-run"; exit 2 ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-first-run"; exit 2 ;;
  esac
  i=$((i + 1))
done
cd "${ROOT}"
```

Run:

```bash
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-first-run-guide.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output includes install verification, project orientation, project-map evolution, insight-injection inspection, profile readiness, bounded work-item steps, and stop conditions.
- [ ] The guide does not mutate files, install packages, push, tag, or call GitHub.
</success_criteria>
