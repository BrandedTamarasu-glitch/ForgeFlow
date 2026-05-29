---
name: forgeflow-learning-policy
description: Show or seed the local learning signal decay policy
argument-hint: "[--seed] [--json]"
allowed-tools:
  - Bash
---
<objective>
Show or seed the local policy that controls advisory learning-signal age, reinforcement, and decay penalties.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--seed` and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/learning-signal-policy.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/learning-signal-policy.js" ]; then
  echo "Learning policy helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-learning-policy."
  exit 1
fi
SAFE_ARGS=(--project-dir "${FORGEFLOW_DIR}")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --seed) SAFE_ARGS+=(--seed) ;;
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-learning-policy"; exit 2 ;;
  esac
done
"${HELPER_DIR}/learning-signal-policy.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output explains the advisory boundary.
- [ ] `--seed` writes only `.forgeflow/<project>/learning-signal-policy.json`.
- [ ] Learning status consumes the policy when present.
</success_criteria>
