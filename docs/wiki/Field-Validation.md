# Field Validation

Use this plan to validate Forgeflow on real branches across representative project types. The goal is to collect comparable local evidence, not to publish raw project data.

## Trial Matrix

Run at least one branch trial in each project type:

| Project Type | Example Change | Useful Forgeflow Signals |
|---|---|---|
| Frontend app | form state, API integration, accessibility fix | Lumen findings, service path checks, accessibility classes |
| API service | auth boundary, validation, persistence change | Warden findings, Smith data-layer findings, Aegis decisions |
| Monorepo | package boundary, shared config, generated clients | Atlas coordination notes, scope manifest size, budget warnings |
| Docs/config | command docs, release docs, CI config | skip/thin routing, release-check output, low-noise review |
| Release prep | version bump, changelog, installer docs | release-check pass/fail, health/version guidance, public summary quality |

## Per-Branch Steps

For each branch:

1. Run [Branch Trial](Branch-Trial).
2. Save a local outcome record with `review.workflow` set to `forgeflow`.
3. If possible, record comparable `no-agent` and `single-agent` outcomes for the same change using [Workflow Comparison](Workflow-Comparison).
4. Generate a public-safe evaluation summary:

```bash
scripts/forgeflow/render-evaluation-report.js \
  --outcomes .forgeflow/<project>/review-outcomes.jsonl \
  --context-root .forgeflow \
  --budget-config .forgeflow-budget.json \
  --public \
  --out .forgeflow/<project>/evaluation-summary.md
```

5. Review the summary using [Evaluation Sharing](Evaluation-Sharing).
6. Store the summary using [Evaluation Summary Collection](Evaluation-Summary-Collection).
7. Record first-run friction separately from review quality.

## Friction Log

Track friction in a local note, issue, or spreadsheet. Use these fields:

```text
project_type:
runtime: claude-code | codex | both
install_path: update-forgeflow | template-installer | existing-install
branch_shape:
review_mode:
context_budget_status:
time_to_first_review_minutes:
blocked_by:
fix_category: install | health | docs | template-installer | agent-routing | context-budget | other
notes:
```

Do not include secrets, private URLs, or source snippets.

## Aggregate Evidence

For each project type, keep only aggregate values in shareable notes:

- reviewed changes
- confirmed findings
- rejected findings
- false positive rate
- average review minutes
- context percent saved
- budget violations
- first-run blockers by category

Raw `review-outcomes.jsonl`, context packets, and telemetry rows should stay local unless the receiving audience is allowed to see the underlying project context.

Use [Evaluation Summary Collection](Evaluation-Summary-Collection) to keep summaries organized during field validation.

## Exit Criteria

Field validation is ready to turn into product fixes when repeated friction appears in the same category. Examples:

- install friction repeats across Codex trials
- health checks pass but users still miss restart requirements
- context budget violations repeat in monorepos
- public summaries need manual cleanup every time
- routing misses a class of files in more than one project

When that happens, create a targeted fix in the relevant install, health, docs, routing, or context helper.
