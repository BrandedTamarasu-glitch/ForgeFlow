# Branch Trial

Use this flow to try Forgeflow on one real branch without committing generated local state. It is meant for adoption trials, demos, and side-by-side comparisons against no-agent or single-agent review.

## Setup

Start from a git branch with the change you want to evaluate:

```bash
git status --short
git branch --show-current
```

If the project does not already ignore Forgeflow local state, add these patterns to a local exclude file instead of changing the repo:

```bash
printf ".forgeflow/\n.forgeflow-budget.json\n" >> .git/info/exclude
```

This keeps trial artifacts local while avoiding a repository change.

## Verify Install

From Claude Code:

```text
/forgeflow-version
/forgeflow-health
```

From a checkout or installed helper root:

```bash
scripts/forgeflow/ensure-forgeflow-state.sh
scripts/forgeflow/health-check.js --fix --json
```

If you installed without a checkout, replace `scripts/forgeflow/` with:

```text
~/.claude/forgeflow/scripts/forgeflow/
```

## Run The Trial

Run one review on the branch:

```text
/review
```

For a narrower trial, pass a commit range or paths:

```text
/review HEAD~3..HEAD
/review src/auth.ts src/db.ts
```

Then inspect local context and budget signals:

```bash
scripts/forgeflow/advise-context.js --root .forgeflow --record --json
scripts/forgeflow/summarize-context-telemetry.js --root .forgeflow --json
scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json
```

## Compare Results

Record the outcome after human triage. Use `review.workflow` to compare workflows:

```json
{
  "schema_version": "1",
  "change_id": "local-branch-name",
  "review": {
    "workflow": "forgeflow",
    "mode": "full-mode",
    "agents_used": ["smith_reviewer", "warden_reviewer"],
    "verifier_decisions": []
  },
  "outcome": {
    "findings_total": 2,
    "findings_confirmed": 1,
    "findings_rejected": 1,
    "review_minutes": 18,
    "auto_fix_success": false,
    "post_merge_regression": false,
    "finding_classes": [
      { "class": "auth/session/permissions", "total": 1, "confirmed": 1, "rejected": 0 },
      { "class": "missing-transaction", "total": 1, "confirmed": 0, "rejected": 1 }
    ]
  }
}
```

Append and summarize locally:

```bash
scripts/forgeflow/record-review-outcome.js --input outcome.json --out .forgeflow/$(basename "$PWD")/review-outcomes.jsonl --json
scripts/forgeflow/render-evaluation-report.js --outcomes .forgeflow/$(basename "$PWD")/review-outcomes.jsonl --context-root .forgeflow --public
```

For a side-by-side comparison, repeat the same change with `review.workflow` set to `no-agent`, `single-agent`, and `forgeflow`. See [Workflow Comparison](Workflow-Comparison) for the full comparison flow.

## Clean Up

Review generated local state:

```bash
git status --short
find .forgeflow -maxdepth 3 -type f | sort
```

Leave `.forgeflow/` in place if you want local memory and trend history. Remove it if the trial is done:

```bash
rm -rf .forgeflow .forgeflow-budget.json
```

Do not commit trial output unless the project explicitly wants those local records in version control.
