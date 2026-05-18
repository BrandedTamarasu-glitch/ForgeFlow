# Pilot Public Summary

Use this after a real maintainer pilot when the selected sharing level allows a public-safe summary. The summary should provide aggregate evidence without exposing raw review records, context packets, source snippets, or private project details.

## Precheck

Before generating a summary, confirm:

- the pilot has a [Pilot Evidence Log](Pilot-Evidence-Log) entry
- the sharing level in [Team Privacy Boundaries](Team-Privacy-Boundaries) allows public or private-team summary sharing
- human triage has marked findings as confirmed, rejected, or deferred
- `.forgeflow/` is ignored or intentionally local
- raw records will not be committed

If any of these are false, keep the evidence local and skip public summary generation.

## Generate

Create a timestamped public summary:

```bash
PROJECT="$(basename "$PWD")"
STAMP="$(date +%Y%m%d-%H%M)"
OUT_DIR=".forgeflow/${PROJECT}/public-summaries"
mkdir -p "${OUT_DIR}"

scripts/forgeflow/render-evaluation-report.js \
  --outcomes ".forgeflow/${PROJECT}/review-outcomes.jsonl" \
  --context-root .forgeflow \
  --budget-config .forgeflow-budget.json \
  --public \
  --out "${OUT_DIR}/${STAMP}-evaluation-summary.md"
```

If the project does not have context telemetry or a budget config yet, omit `--context-root` or `--budget-config` rather than inventing values.

## Inspect

Read the summary before sharing:

```bash
sed -n '1,220p' "${OUT_DIR}/${STAMP}-evaluation-summary.md"
```

Check for:

- private project names
- private branch names
- customer names
- private URLs
- proprietary feature names
- security findings that need disclosure approval
- file paths or reviewer comments that reveal source details

If any appear, redact or keep the summary private.

## Record

Update the pilot evidence note:

```yaml
public_summary_generated: yes
public_summary_path:
sharing_level:
redactions_made:
shared_with:
```

## Share

Prefer one of these formats:

- the generated summary file after review
- copied aggregate tables
- a screenshot of the aggregate summary
- a short note using the language from [Evaluation Sharing](Evaluation-Sharing)

Do not share `review-outcomes.jsonl`, raw context packets, memory summaries, or telemetry rows unless the receiving audience is allowed to see the underlying project context.
