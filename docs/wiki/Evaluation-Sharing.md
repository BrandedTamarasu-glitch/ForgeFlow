# Evaluation Sharing

Forgeflow evaluation records are local-first. Share aggregate summaries, not raw records, unless the project is public and the team explicitly wants richer attribution.

## Keep Local

Do not publish these files by default:

```text
.forgeflow/<project>/review-outcomes.jsonl
.forgeflow/<project>/evaluation-report.md
.forgeflow/context-advisor-history.jsonl
.forgeflow/**/context-telemetry.json
.forgeflow/**/memory-context-telemetry.json
.forgeflow/**/scope-telemetry.json
```

They can contain branch names, task text, file paths, review notes, and local telemetry.

## Share Public Summaries

Generate a public-safe aggregate report:

```bash
scripts/forgeflow/render-evaluation-report.js \
  --outcomes .forgeflow/<project>/review-outcomes.jsonl \
  --context-root .forgeflow \
  --budget-config .forgeflow-budget.json \
  --public \
  --out .forgeflow/<project>/evaluation-summary.md
```

The public summary includes aggregate quality rates, workflow comparison rows, context savings, and privacy notes. It omits raw outcome rows.

## Review Before Sharing

Before posting or attaching a summary:

```bash
sed -n '1,220p' .forgeflow/<project>/evaluation-summary.md
```

Check for:

- private project names
- private branch names
- customer names
- proprietary feature names
- private URLs
- security findings that need disclosure approval

Remove or generalize anything project-specific.

## Suggested Language

Use phrasing like this when sharing externally:

```text
This report is generated from local anonymized Forgeflow outcome records. It reports aggregate review quality, workflow comparison, and context-efficiency metrics. Raw review records, code snippets, file paths, and telemetry rows are not included.
```

## Internal Sharing

For private team review, prefer sharing:

- `evaluation-summary.md`
- screenshots of the public summary
- copied aggregate tables
- sanitized examples from [Public-Safe Examples](Public-Examples)

Share raw JSONL only when the receiving audience is allowed to see the underlying project context.
