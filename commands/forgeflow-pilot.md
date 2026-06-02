---
name: forgeflow-pilot
description: Print the repeatable pilot or new-user trial script and public-safe result template.
argument-hint: "[--runtime claude-code|codex] [--project-name <name>] [--path maintainer|new-user] [--json]"
allowed-tools:
  - Bash
---

<objective>
Print a short script for one bounded Forgeflow trial. The maintainer path covers install verification, baseline smoke, trends, report, code map, one work item, final report, evidence recording, and rollup. The new-user path adds a first-real-task route that helps a net-new user judge setup, guidance quality, review usefulness, and whether the next task starts smarter.
</objective>

<context>
$ARGUMENTS:
- `--runtime claude-code|codex` - choose the command style to render.
- `--project-name <name>` - override the inferred project name in output.
- `--path maintainer|new-user` - choose the maintainer pilot script or the first-real-task new-user script.
- `--json` - print structured output instead of Markdown.

The command uses `scripts/forgeflow/render-pilot-script.js`.
</context>

## Gotchas

- **This prints a script; it does not run the pilot.** The user still chooses the branch, executes the work item, and triages findings.
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

Before Bash, parse `$ARGUMENTS` in the assistant layer. Accept only `--runtime claude-code|codex`, `--project-name <name>`, `--path maintainer|new-user`, and `--json`. Reject unexpected flags or shell metacharacters. Build `ARGS` only from validated values.

```bash
ARGS=()
# Append only validated values, for example:
# ARGS+=(--runtime "codex")
# ARGS+=(--path "new-user")
# ARGS+=(--json)
if [ -n "$VALIDATED_RUNTIME" ]; then ARGS+=(--runtime "$VALIDATED_RUNTIME"); fi
if [ -n "$VALIDATED_PATH" ]; then ARGS+=(--path "$VALIDATED_PATH"); fi
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-pilot-script.js" "${ARGS[@]}"
```

Print the helper output directly.

</process>

<success_criteria>
- [ ] Output includes install verification
- [ ] Output includes smoke, trends, report, and code-map checks
- [ ] Output includes one bounded work item and review
- [ ] Output includes final report, evidence recording, and rollup
- [ ] `--path new-user` output includes first-run readiness, project orientation, first real work item, and adoption decision steps
- [ ] Output includes a public-safe result template
</success_criteria>
