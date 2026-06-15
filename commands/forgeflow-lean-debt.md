---
name: forgeflow-lean-debt
description: Build a local ledger of lean shortcuts, ceilings, and missing upgrade triggers
argument-hint: "[--json] [--write]"
allowed-tools:
  - Bash
---
<objective>
Show a read-only local ledger of `forgeflow:` lean markers, lean-decision ceilings, and implementation-note upgrade triggers. Use this when a small-path decision needs to stay visible so "later" does not become untracked debt.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments, `--json`, `--write`, or both.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-debt.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-debt.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-debt.js" ]; then
  echo "Lean debt helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-debt."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "") ;;
    --json|--write) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-lean-debt"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-debt.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output groups lean markers, lean-decision ceilings, and implementation-note tradeoffs.
- [ ] Output flags shortcuts that do not name an upgrade trigger.
- [ ] `--write` writes only `.forgeflow/<project>/context/lean-debt.md` and `.json`.
- [ ] The command does not edit code, delete markers, infer global policy, commit, push, or call the network.
</success_criteria>
