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
if [ ! -x "${HELPER_DIR}/render-first-run-guide.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-first-run-guide.js" ]; then
  echo "First-run guide helper is not installed. Run /update-forgeflow, then retry /forgeflow-first-run."
  exit 1
fi
cd "${ROOT}"
```

Run:

```bash
"${HELPER_DIR}/render-first-run-guide.js" <validated args>
```
</process>

<success_criteria>
- [ ] Output includes install verification, project orientation, project-map evolution, insight-injection inspection, profile readiness, bounded work-item steps, and stop conditions.
- [ ] The guide does not mutate files, install packages, push, tag, or call GitHub.
</success_criteria>
