---
name: forgeflow-smoke
description: Run the local Forgeflow stabilization smoke path and report pass, warn, or fail.
argument-hint: "[--json] [--root <dir>] [--project-dir <dir>] [--patterns-dir <dir>]"
allowed-tools:
  - Bash
---

<objective>
Run the repeatable Forgeflow smoke path for the current checkout. The smoke checks health, refreshes project guidance, renders the report refresh path, renders the code map, and verifies docs/release metadata guards.

Answers: "Is this checkout locally coherent enough to continue work, commit, push, or run a pilot?"
</objective>

<context>
$ARGUMENTS:
- `--json` — structured output instead of Markdown
- `--root <dir>` — repository root to check
- `--project-dir <dir>` — project-local `.forgeflow/<project>` directory
- `--patterns-dir <dir>` — pattern log directory for report rendering

The command uses `scripts/forgeflow/smoke-check.js`.
</context>

## Gotchas

- **Warnings are actionable.** Import gaps and context budget warnings do not fail the smoke by default; they should include the next command or trim guidance.
- **Refresh writes local artifacts.** The smoke refreshes project learnings, latest insights, code-map history, context telemetry, and report context.
- **Local-only.** Smoke output is meant for local confidence and pilot readiness, not a public CI claim.

<process>

## Step 1: Resolve helper

```bash
HELPER_DIR="scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/smoke-check.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/smoke-check.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
```

If `${HELPER_DIR}/smoke-check.js` is missing, stop with:

```text
Smoke helper is not installed. Run /update-forgeflow, then retry /forgeflow-smoke.
```

## Step 2: Run smoke

Pass through `$ARGUMENTS`.

```bash
"${HELPER_DIR}/smoke-check.js" $ARGUMENTS
```

Print the helper output directly.

</process>

<success_criteria>
- [ ] Output includes health status
- [ ] Output includes trends refresh status
- [ ] Output includes report refresh and context budget status
- [ ] Output includes code-map import-gap status
- [ ] Output includes docs and release metadata guard status
- [ ] Failures include the exact helper or command to inspect
</success_criteria>
