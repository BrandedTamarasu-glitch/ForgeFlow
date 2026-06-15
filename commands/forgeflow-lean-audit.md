---
name: forgeflow-lean-audit
description: Run a read-only repo-wide audit for over-engineering candidates
argument-hint: "[--json] [--write]"
allowed-tools:
  - Bash
---
<objective>
Run a read-only whole-repo lean audit for over-engineering candidates: avoidable dependencies, one-caller abstractions, delegating wrappers, future-proofing, and lean shortcut debt. Findings are advisory static signals only.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only no arguments, `--json`, `--write`, or both.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-lean-audit.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-lean-audit.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-lean-audit.js" ]; then
  echo "Lean audit helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-lean-audit."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    "") ;;
    --json|--write) SAFE_ARGS+=("$arg") ;;
    *) echo "Unsupported arguments for /forgeflow-lean-audit"; exit 2 ;;
  esac
done
cd "${ROOT}"
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-lean-audit.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output ranks repo-wide over-engineering candidates with class, replacement, confidence, and estimated net-line impact.
- [ ] Output skips hard-boundary, security, accessibility, validation, and test scopes.
- [ ] `--write` writes only `.forgeflow/<project>/context/lean-audit.md` and `.json`.
- [ ] The command does not edit code, delete files, remove dependencies, apply review-auto fixes, commit, push, or call the network.
</success_criteria>
