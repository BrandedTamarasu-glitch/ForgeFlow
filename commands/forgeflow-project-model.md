---
name: forgeflow-project-model
description: Build and show the local project operating model for planning and review guidance
argument-hint: "[--json] [--refresh] [--out <path>]"
allowed-tools:
  - Bash
---
<objective>
Build and display the local project operating model from existing Forgeflow topology, project intelligence, learnings, review outcomes, validation patterns, and user profile signals.

The model is advisory guidance for planning and review. It is not approval, proof of runtime behavior, or permission to auto-fix high-risk changes.
</objective>

<context>
$ARGUMENTS:
- `--json` — structured output instead of Markdown
- `--refresh` — refresh underlying project intelligence before rendering
- `--out <path>` — write the JSON artifact to a custom path
</context>

## Gotchas

- **Advisory only.** Current user instructions, current code, tests, and review evidence always take precedence.
- **Local-first.** The helper reads and writes local artifacts only. It does not call GitHub, install, repair, commit, push, or publish.
- **No auto-fix behavior change.** Review-auto can use the model later as guidance, but this command does not apply fixes.
- **Safe output paths only.** Pass `--out` only for a normal local file path. Shell control characters and parent path traversal are rejected.

<process>

## Step 1: Resolve helper

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/build-project-operating-model.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/build-project-operating-model.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/build-project-operating-model.js" ]; then
  echo "Project operating model helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-project-model."
  exit 1
fi
```

## Step 2: Validate arguments

```bash
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
idx=0
while [ "$idx" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$idx]}"
  case "$arg" in
    --json|--refresh)
      SAFE_ARGS+=("$arg")
      ;;
    --out)
      idx=$((idx + 1))
      value="${USER_ARGS[$idx]:-}"
      if [ -z "$value" ] || [[ "$value" == --* ]] || [[ "$value" == *".."* ]] || [[ "$value" == *";"* ]] || [[ "$value" == *"|"* ]] || [[ "$value" == *"&"* ]] || [[ "$value" == *"<"* ]] || [[ "$value" == *">"* ]]; then
        echo "Invalid --out for /forgeflow-project-model"
        exit 2
      fi
      SAFE_ARGS+=(--out "$value")
      ;;
    "")
      ;;
    *)
      echo "Unsupported arguments for /forgeflow-project-model"
      exit 2
      ;;
  esac
  idx=$((idx + 1))
done
```

## Step 3: Render model

```bash
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/build-project-operating-model.js" "${SAFE_ARGS[@]}"
```

</process>

<success_criteria>
- [ ] Output is local-first and advisory.
- [ ] Output includes status, confidence, domains, high-care files, risk zones, validation guidance, operating preferences, agent guidance, and proof boundary.
- [ ] `--json`, `--refresh`, and `--out <path>` are supported with safe argument handling.
- [ ] Missing helper produces an actionable repair instruction.
</success_criteria>
