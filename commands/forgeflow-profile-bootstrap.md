---
name: forgeflow-profile-bootstrap
description: Preview or write explicit user operating and project experience profile preferences
argument-hint: "[--prompts] [--communication <text>] [--autonomy <text>] [--validation <text>] [--ui <text>] [--write] [--json]"
allowed-tools:
  - Bash
---
<objective>
Preview or write explicit profile preferences so Forgeflow can adapt how it communicates, validates, works autonomously, and handles project look and feel.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--prompts`, `--communication`, `--autonomy`, `--risk`, `--validation`, `--release`, `--workflow`, `--ui`, `--product-copy`, `--accessibility`, `--write`, and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-profile-bootstrap.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-profile-bootstrap.js" ]; then
  echo "Profile bootstrap helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-profile-bootstrap."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --args "${ARGUMENTS:-}")
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-profile-bootstrap.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Default output is a preview and does not write profile records.
- [ ] `--prompts` shows explicit questions to answer before writing preferences.
- [ ] `--write` records only explicit preference arguments.
- [ ] Output explains that preferences are advisory and never inferred.
</success_criteria>
