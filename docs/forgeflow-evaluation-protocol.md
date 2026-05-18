# Forgeflow Evaluation Protocol

Use this protocol to compare Forgeflow modes on real work without sending private code or telemetry anywhere.

## Record Shape

Each reviewed change gets one JSON record. Store local records in:

```text
.forgeflow/<project>/review-outcomes.jsonl
```

Required fields:

- `schema_version`: `"1"`
- `change_id`: local PR, branch, commit, or fixture id
- `review.mode`: `skip-mode`, `thin-mode`, `full-mode`, or `deep-mode`
- `review.agents_used`: agents that actually ran
- `review.verifier_decisions`: Aegis decisions, if any
- `outcome.findings_total`: total surfaced findings
- `outcome.findings_confirmed`: findings accepted by the maintainer
- `outcome.findings_rejected`: findings rejected by the maintainer
- `outcome.review_minutes`: elapsed review time
- `outcome.auto_fix_success`: whether automated fixes landed cleanly
- `outcome.post_merge_regression`: whether a known regression followed
- `outcome.finding_classes`: per-class totals for calibration

## Workflow

1. Run the review normally and keep the route JSON.
2. After human triage, write one outcome record using the sample fixture as a template.
3. Append the record:

```bash
scripts/forgeflow/record-review-outcome.js --input outcome.json
```

4. Summarize local outcomes:

```bash
scripts/forgeflow/record-review-outcome.js --summary .forgeflow/Forgeflow/review-outcomes.jsonl --json
```

5. Render a local evaluation report:

```bash
scripts/forgeflow/render-evaluation-report.js --outcomes .forgeflow/Forgeflow/review-outcomes.jsonl --out .forgeflow/Forgeflow/evaluation-report.md
```

## Metrics

Track:

- confirmed defects found
- false positives
- verifier rejection rate
- review latency
- maintainer agreement
- auto-fix success/failure
- post-merge regressions when known
- accessibility findings as a first-class finding class

The generated report includes confirmation rate, false positive rate, verifier rejection rate, auto-fix success rate, regression rate, average review minutes, mode counts, and per-class finding totals.

## Privacy Rules

Keep records anonymized unless the repo is already public and the user asks for richer attribution. Do not include secrets, customer data, private URLs, access tokens, or large code snippets in outcome records.
