---
name: forgeflow-lean-session
description: Render compact always-on lean session guidance for hooks or adapters
argument-hint: "[--profile lite|off|balanced|strict|ultra] [--json]"
allowed-tools:
  - Bash
---
<objective>
Render compact Forgeflow lean guidance suitable for hook/session injection or manual adapter use. This is display-only by default and never edits settings or installs hooks.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments, `--json`, and `--profile lite|off|balanced|strict|ultra`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-session.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-session.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-session.js" ]; then
  echo "Lean session helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-session."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
i=0
while [ "$i" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$i]}"
  case "$arg" in
    "") ;;
    --json) SAFE_ARGS+=("$arg") ;;
    --profile)
      next_i=$((i + 1))
      profile="${USER_ARGS[$next_i]:-}"
      case "$profile" in
        lite|off|balanced|strict|ultra) SAFE_ARGS+=("--profile" "$profile"); i=$next_i ;;
        *) echo "Unsupported lean profile for /forgeflow-lean-session"; exit 2 ;;
      esac
      ;;
    *) echo "Unsupported arguments for /forgeflow-lean-session"; exit 2 ;;
  esac
  i=$((i + 1))
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-session.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output shows effective profile, source, statusline text, and compact instructions.
- [ ] The command does not edit settings, install hooks, mutate context, change routing, commit, push, or call the network.
</success_criteria>
