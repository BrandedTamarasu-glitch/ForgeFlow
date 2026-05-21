---
name: forgeflow-pilot
description: Print the repeatable maintainer pilot script and public-safe result template.
argument-hint: "[--runtime claude-code|codex] [--project-name <name>] [--json]"
allowed-tools:
  - Bash
---

<objective>
Print a short maintainer pilot script for one bounded Forgeflow trial. The script covers install verification, baseline smoke, trends, report, code map, one work item, final report, evidence recording, and rollup.
</objective>

<context>
$ARGUMENTS:
- `--runtime claude-code|codex` - choose the command style to render.
- `--project-name <name>` - override the inferred project name in output.
- `--json` - print structured output instead of Markdown.

The command uses `scripts/forgeflow/render-pilot-script.js`.
</context>

## Gotchas

- **This prints a script; it does not run the pilot.** The maintainer still chooses the branch, executes the work item, and triages findings.
- **Raw evidence stays local.** Share only aggregate counts and public-safe notes unless the project explicitly agrees otherwise.
- **Warnings should become evidence.** Import gaps, budget warnings, install friction, and confusing commands should be recorded with `record-pilot-evidence.js`.

<process>

## Step 1: Resolve helper

```bash
HELPER_DIR="scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/render-pilot-script.js" ] && [ -f "$HOME/.claude/forgeflow/scripts/forgeflow/render-pilot-script.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
```

If `${HELPER_DIR}/render-pilot-script.js` is missing, stop with:

```text
Pilot script helper is not installed. Run /update-forgeflow, then retry /forgeflow-pilot.
```

## Step 2: Render script

Pass through `$ARGUMENTS`.

```bash
node "${HELPER_DIR}/render-pilot-script.js" $ARGUMENTS
```

Print the helper output directly.

</process>

<success_criteria>
- [ ] Output includes install verification
- [ ] Output includes smoke, trends, report, and code-map checks
- [ ] Output includes one bounded work item and review
- [ ] Output includes final report, evidence recording, and rollup
- [ ] Output includes a public-safe result template
</success_criteria>
