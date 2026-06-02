---
name: forgeflow-smoke
description: Run the Forgeflow downstream, source, or full smoke path and report pass, warn, or fail.
argument-hint: "[--mode downstream|source|full] [--json] [--root <dir>] [--project-dir <dir>] [--patterns-dir <dir>]"
allowed-tools:
  - Bash
---

<objective>
Run the repeatable Forgeflow smoke path for the current checkout. By default, the smoke checks downstream install/project readiness: health, refreshed project guidance, report refresh, and code map. Source/release guards are available with `--mode source`; `--mode full` runs both groups.

Answers: "Is this checkout locally coherent enough to continue work, commit, push, or run a pilot?"
</objective>

<context>
$ARGUMENTS:
- `--json` — structured output instead of Markdown
- `--mode downstream` — default. Run installed/downstream project checks only.
- `--mode source` — run Forgeflow source-tree release guards only.
- `--mode full` — run downstream and source checks together.
- `--root <dir>` — repository root to check
- `--project-dir <dir>` — project-local `.forgeflow/<project>` directory
- `--patterns-dir <dir>` — pattern log directory for report rendering

The command uses `scripts/forgeflow/smoke-check.js`.
</context>

## Gotchas

- **Warnings are actionable.** Import gaps and context budget warnings do not fail the smoke by default; they should include the next command or trim guidance.
- **Expected import gaps are informational.** Code-map smoke reports production, expected, local-accepted, and needs-review import-gap counts separately. Expected asset/data/runtime gaps and exact local acceptances stay visible but do not warn when `needs_review_total` is zero.
- **Refresh writes local artifacts.** The smoke refreshes project learnings, latest insights, code-map history, context telemetry, and report context.
- **Source-tree guards are explicit.** Use `--mode source` for doc links, release metadata, manifest drift, command coverage, and updater tests. Downstream mode avoids repo-only checks.
- **Local-only.** Smoke output is meant for local confidence and pilot readiness, not a public CI claim.

<process>

## Step 1: Resolve helper

```bash
HELPER_DIR="scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/smoke-check.js" ] && [ -f "$HOME/.claude/forgeflow/scripts/forgeflow/smoke-check.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
```

If `${HELPER_DIR}/smoke-check.js` is missing, stop with:

```text
Smoke helper is not installed. Run /update-forgeflow, then retry /forgeflow-smoke.
```

## Step 2: Run smoke

Before Bash, parse `$ARGUMENTS` in the assistant layer. Accept only `--mode downstream|source|full`, `--json`, `--root <dir>`, `--project-dir <dir>`, and `--patterns-dir <dir>`. Reject unexpected flags or shell metacharacters. Build `ARGS` only from validated values.

```bash
ARGS=()
# Append only validated values, for example:
# ARGS+=(--mode "source")
# ARGS+=(--json)
if [ -n "$VALIDATED_MODE" ]; then ARGS+=(--mode "$VALIDATED_MODE"); fi
if [ "$WANTS_JSON" = "true" ]; then ARGS+=(--json); fi
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/smoke-check.js" "${ARGS[@]}"
```

Print the helper output directly.

</process>

<success_criteria>
- [ ] Output includes health status
- [ ] Output includes trends refresh status
- [ ] Output includes report refresh and context budget status
- [ ] Output includes code-map import-gap status
- [ ] Source mode includes docs, release metadata, manifest, command coverage, and updater guard status
- [ ] Failures include the exact helper or command to inspect
</success_criteria>
