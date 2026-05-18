# Workflow Comparison

Use this workflow to compare `no-agent`, `single-agent`, and `forgeflow` reviews on the same change. The goal is comparable evidence, not a perfect lab benchmark.

## Workflow Labels

Use these labels in `review.workflow`:

| Label | Meaning |
|---|---|
| `no-agent` | Human review or baseline review without Forgeflow agents. |
| `single-agent` | One focused AI reviewer or one general AI review pass. |
| `forgeflow` | Forgeflow routed review with synthesis and validation. |

Keep the `change_id` the same across all three records so the report groups the same branch or patch.

## Run Order

Use one branch or patch and collect outcomes in this order:

1. Baseline `no-agent` review.
2. `single-agent` review with one reviewer or one general AI pass.
3. Forgeflow review using `/review` in Claude Code or `$forge-review` in Codex.

Do not change the branch between runs except for temporary notes outside source control. If a run finds an issue, record it first and apply fixes after the comparison is complete.

## Outcome Records

Write one outcome JSON file per workflow. Use the same `change_id` and `finding_classes` vocabulary.

```json
{
  "schema_version": "1",
  "change_id": "branch-trial-001",
  "review": {
    "workflow": "single-agent",
    "mode": "thin-mode",
    "agents_used": ["warden_reviewer"],
    "verifier_decisions": []
  },
  "outcome": {
    "findings_total": 2,
    "findings_confirmed": 1,
    "findings_rejected": 1,
    "review_minutes": 22,
    "auto_fix_success": false,
    "post_merge_regression": false,
    "finding_classes": [
      { "class": "auth/session/permissions", "total": 1, "confirmed": 1, "rejected": 0 },
      { "class": "missing-transaction", "total": 1, "confirmed": 0, "rejected": 1 }
    ]
  }
}
```

Append each record:

```bash
PROJECT="$(basename "$PWD")"
scripts/forgeflow/record-review-outcome.js --input outcome-no-agent.json --out ".forgeflow/${PROJECT}/review-outcomes.jsonl" --json
scripts/forgeflow/record-review-outcome.js --input outcome-single-agent.json --out ".forgeflow/${PROJECT}/review-outcomes.jsonl" --json
scripts/forgeflow/record-review-outcome.js --input outcome-forgeflow.json --out ".forgeflow/${PROJECT}/review-outcomes.jsonl" --json
```

## Generate Comparison

```bash
scripts/forgeflow/render-evaluation-report.js \
  --outcomes ".forgeflow/${PROJECT}/review-outcomes.jsonl" \
  --context-root .forgeflow \
  --budget-config .forgeflow-budget.json \
  --public
```

The `Workflow Comparison` table reports review count, confirmed findings, rejected findings, false positive rate, average review minutes, and regressions for each workflow label.

## Fairness Rules

- Use the same code state for all workflows.
- Use the same human triage criteria for confirmed and rejected findings.
- Count duplicate findings once per workflow.
- Keep speculative notes out of `findings_confirmed`.
- Record review time consistently, including setup time only if it is part of that workflow's real use.
- Do not include raw source snippets in outcome records.

## What To Look For

Useful comparison signals:

- Does Forgeflow find confirmed issues missed by baseline or single-agent review?
- Does Aegis reduce noisy high-risk findings?
- Does routing avoid over-reviewing docs-only or config-only changes?
- Does context packing reduce token load without losing useful findings?
- Does review time stay acceptable for the project type?

If a comparison exposes repeated misses or repeated noise, turn it into a targeted fix for routing, agent prompts, verification, context helpers, or documentation.
