---
name: forgeflow-trends
description: Show the current project's code-map trend, import-gap status, artifact freshness, latest-insights readiness, project-learning consumption, and context-advisor status.
argument-hint: "[--refresh] [--json]"
allowed-tools:
  - Read
  - Bash
---

<objective>
Print a compact local project trends report for the current checkout. The report summarizes code-map trend status, import-gap status, unresolved import delta, changed-section churn, new hotspots, whether the artifacts appear fresh for current HEAD/local changes, whether latest insights are ready and fresh, whether project learnings consumed the trend, and context-advisor health.
When stale guidance is detected without `--refresh`, the report includes a direct recommendation to run `/forgeflow-trends --refresh`.

Answers: "What is changing structurally in this project, are the artifacts and latest insights fresh enough to trust, did project learnings absorb it, and is the context pipeline healthy?"
</objective>

<context>
$ARGUMENTS:
- `--json` — structured output instead of Markdown
- `--refresh` — refresh project learnings, run the quality gate, and smoke-test latest-insights injection before rendering trends

The command uses `scripts/forgeflow/show-project-trends.js`, which reads existing local artifacts:
- `.forgeflow/<project>/context/code-map-history.jsonl`
- `.forgeflow/<project>/context/code-topology.json`
- `.forgeflow/<project>/project-learnings.md`
- `.forgeflow/<project>/context/latest/latest-insights-report.json`
- `.forgeflow/**/context/*-telemetry.json`
</context>

## Gotchas

- **Read-only by default.** Without `--refresh`, this command does not refresh code maps, project learnings, or advisor history. Use `/forgeflow-trends --refresh` when you want a current guidance-health read in one step.
- **Freshness is advisory.** Stale warnings compare the latest recorded code-map and latest-insights commits to current HEAD, flag clean snapshots when the current worktree is dirty, and flag project learnings that have not consumed the latest code-map snapshot count.
- **Local-only signal.** Missing artifacts mean the trend is unavailable, not that the project has no trend.
- **Import gaps are triage hints.** Unresolved imports and skipped dynamic imports are surfaced from the latest topology artifact with `/forgeflow-code-map` as the detailed follow-up.
- **Guidance only.** Structural trends prioritize attention; they are not proof of runtime defects.

<process>

## Step 1: Resolve helper

```bash
HELPER_DIR="scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/show-project-trends.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/show-project-trends.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
```

If `${HELPER_DIR}/show-project-trends.js` is missing, stop with:

```text
Project trends helper is not installed. Run /update-forgeflow, then retry /forgeflow-trends.
```

## Step 2: Render trends

Before Bash, parse `$ARGUMENTS` in the assistant layer. Accept only `--refresh` and `--json`. Reject unexpected flags or shell metacharacters. Build `ARGS` only from validated values.

Run:

```bash
ARGS=()
# Append --refresh and --json only when requested.
if [ "$WANTS_REFRESH" = "true" ]; then ARGS+=(--refresh); fi
if [ "$WANTS_JSON" = "true" ]; then ARGS+=(--json); fi
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/show-project-trends.js" "${ARGS[@]}"
```

Print the helper output directly.

</process>

<success_criteria>
- [ ] The command prints a compact project trends report or JSON summary
- [ ] `--refresh` refreshes project learnings and latest-insights readiness before rendering
- [ ] Output includes code-map trend status
- [ ] Output includes import-gap status and a code-map follow-up when gaps are present
- [ ] Output includes artifact freshness status and concrete stale/missing reasons
- [ ] Output includes latest-insights readiness and freshness
- [ ] Stale artifact output includes the next refresh command
- [ ] Output shows whether project learnings consumed trend history
- [ ] Output includes context-advisor budget/status
- [ ] Missing helper produces an actionable update instruction
</success_criteria>
