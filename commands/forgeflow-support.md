---
name: forgeflow-support
description: Create a local Forgeflow support bundle with version, health, smoke, readiness, docs drift, and trends summaries
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Create a local support/debug bundle for the current project without tagging, pushing, publishing, or calling GitHub.
</objective>

<process>

Run from the target project:

```bash
HELPER_DIR="scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-support-bundle.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/render-support-bundle.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi

ARGS=()
JSON_FLAG="--json"
if printf '%s\n' "$ARGUMENTS" | grep -Eq '(^|[[:space:]])--json([[:space:]]|$)'; then
  ARGS+=("${JSON_FLAG}")
fi

env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-support-bundle.js" "${ARGS[@]}"
```

If the command reports `fail` or `blocked`, follow the listed next actions. The bundle is local support data and may include local paths; review and redact it before sharing outside the trusted project/team context.

</process>

<success_criteria>
- [ ] JSON and Markdown support bundle artifacts are written under `.forgeflow/<project>/support/`
- [ ] Bundle includes version, health, smoke, release readiness, docs drift, and trends summaries
- [ ] Output lists concrete next actions for warnings or failures
- [ ] No GitHub action, tag, push, or publish step runs
</success_criteria>
