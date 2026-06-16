---
name: forgeflow-lean-mode
description: Show or persist the project lean guidance profile
argument-hint: "[--profile lite|off|balanced|strict|ultra] [--write] [--json]"
allowed-tools:
  - Bash
---
<objective>
Show or persist the project-local lean guidance profile used by context packs. The mode is advisory only; it never edits code, removes dependencies, shrinks validation, changes routing, commits, pushes, or calls the network.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments, `--json`, `--write`, and `--profile lite|off|balanced|strict|ultra`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-mode.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-mode.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-mode.js" ]; then
  echo "Lean mode helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-mode."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
i=0
while [ "$i" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$i]}"
  case "$arg" in
    "") ;;
    --json|--write) SAFE_ARGS+=("$arg") ;;
    --profile)
      next_i=$((i + 1))
      profile="${USER_ARGS[$next_i]:-}"
      case "$profile" in
        lite|off|balanced|strict|ultra) SAFE_ARGS+=("--profile" "$profile"); i=$next_i ;;
        *) echo "Unsupported lean profile for /forgeflow-lean-mode"; exit 2 ;;
      esac
      ;;
    *) echo "Unsupported arguments for /forgeflow-lean-mode"; exit 2 ;;
  esac
  i=$((i + 1))
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-mode.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output shows the effective project lean profile and whether lean guidance is enabled.
- [ ] `--write` writes only `.forgeflow/<project>/context/lean-policy.md` and `.json`.
- [ ] Profiles are limited to `lite`, `off`, `balanced`, `strict`, and `ultra`.
- [ ] The command remains advisory and does not change implementation, review, commit, push, or network behavior.
</success_criteria>
