---
name: forgeflow-trends
description: Show the current project's code-map trend, artifact freshness, project-learning consumption, and context-advisor status.
argument-hint: "[--json]"
allowed-tools:
  - Read
  - Bash
---

<objective>
Print a compact local project trends report for the current checkout. The report summarizes code-map trend status, unresolved import delta, changed-section churn, new hotspots, whether the artifacts appear fresh for current HEAD/local changes, whether project learnings consumed the trend, and context-advisor health.

Answers: "What is changing structurally in this project, are the artifacts fresh enough to trust, did project learnings absorb it, and is the context pipeline healthy?"
</objective>

<context>
$ARGUMENTS:
- `--json` — structured output instead of Markdown

The command uses `scripts/forgeflow/show-project-trends.js`, which reads existing local artifacts:
- `.forgeflow/<project>/context/code-map-history.jsonl`
- `.forgeflow/<project>/project-learnings.md`
- `.forgeflow/**/context/*-telemetry.json`
</context>

## Gotchas

- **Read-only summary.** This command does not refresh code maps, project learnings, or advisor history. Run `/forgeflow-code-map`, `/forgeflow-learnings --project`, or `/forgeflow-report` first when artifacts are stale.
- **Freshness is advisory.** Stale warnings compare the latest recorded code-map commit to current HEAD, flag clean snapshots when the current worktree is dirty, and flag project learnings that have not consumed the latest code-map snapshot count.
- **Local-only signal.** Missing artifacts mean the trend is unavailable, not that the project has no trend.
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

Pass through `--json` from `$ARGUMENTS`.

Run:

```bash
"${HELPER_DIR}/show-project-trends.js" $ARGUMENTS
```

Print the helper output directly.

</process>

<success_criteria>
- [ ] The command prints a compact project trends report or JSON summary
- [ ] Output includes code-map trend status
- [ ] Output includes artifact freshness status and concrete stale/missing reasons
- [ ] Output shows whether project learnings consumed trend history
- [ ] Output includes context-advisor budget/status
- [ ] Missing helper produces an actionable update instruction
</success_criteria>
