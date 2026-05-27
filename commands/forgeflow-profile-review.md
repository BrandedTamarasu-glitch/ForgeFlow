---
name: forgeflow-profile-review
description: Render advisory user-profile review actions before agent-heavy work
argument-hint: "[--commands-only] [--json]"
allowed-tools:
  - Bash
---
<objective>
Show local profile conflicts, scope moves, ask-user prompts, and cleanup actions. This command is advisory and never records or edits preferences.
</objective>

<context>
$ARGUMENTS:
- `--commands-only` - show only copy-ready advisory profile commands.
- `--json` - structured output.
</context>

<process>
Validate `$ARGUMENTS`. Accept only `--commands-only` and `--json`; reject every other flag or shell metacharacter.

Resolve helpers:

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-profile-review.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-profile-review.js" ]; then
  echo "Profile review helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-profile-review."
  exit 1
fi
```

Build an argv array from validated arguments:

```bash
SAFE_ARGS=(--project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    --commands-only) SAFE_ARGS+=(--commands-only) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-profile-review"; exit 2 ;;
  esac
done
"${HELPER_DIR}/render-profile-review.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output groups conflicts, scope moves, ask-user prompts, and cleanup items.
- [ ] Output says profile guidance is advisory and requires explicit confirmation before recording changes.
</success_criteria>
