# Evaluation Summary Collection

Use this workflow to collect public-safe evaluation summaries from real reviews during field validation. It keeps raw records local while making aggregate evidence easy to compare.

For maintainer pilot trials, use [Pilot Public Summary](Pilot-Public-Summary) before adding summaries to a broader collection.

## Collection Folder

Store shareable summaries outside source control by default:

```text
.forgeflow/<project>/public-summaries/
```

Create the folder locally:

```bash
mkdir -p .forgeflow/$(basename "$PWD")/public-summaries
```

If the project does not already ignore `.forgeflow/`, add it to local exclude:

```bash
printf ".forgeflow/\n.forgeflow-budget.json\n" >> .git/info/exclude
```

## Generate A Summary

After a branch trial and human triage:

```bash
PROJECT="$(basename "$PWD")"
STAMP="$(date +%Y%m%d-%H%M)"

scripts/forgeflow/render-evaluation-report.js \
  --outcomes ".forgeflow/${PROJECT}/review-outcomes.jsonl" \
  --context-root .forgeflow \
  --budget-config .forgeflow-budget.json \
  --public \
  --out ".forgeflow/${PROJECT}/public-summaries/${STAMP}-evaluation-summary.md"
```

Read the generated file before sharing:

```bash
sed -n '1,220p' ".forgeflow/${PROJECT}/public-summaries/${STAMP}-evaluation-summary.md"
```

## Metadata To Capture

Keep a separate local note with this metadata for each summary:

```text
summary_file:
project_type: frontend | api | monorepo | docs-config | release-prep | other
runtime: claude-code | codex | both
install_path: update-forgeflow | template-installer | existing-install
workflow_labels_present: no-agent | single-agent | forgeflow
reviewed_changes:
context_budget_status:
first_run_blockers:
notes:
```

Do not put private branch names, customer names, private URLs, secrets, or source snippets in the shareable summary.

## What To Share

Share one of these:

- the generated `evaluation-summary.md`
- copied aggregate tables from the summary
- screenshots of the summary
- a short written note using the suggested language in [Evaluation Sharing](Evaluation-Sharing)

Do not share raw `review-outcomes.jsonl`, context packets, memory summaries, or telemetry rows unless the receiving audience is allowed to see the underlying project context.

## Rollup Checklist

When enough summaries are collected, build a small rollup with:

- number of project types covered
- number of reviewed changes
- confirmation rate range
- false positive rate range
- average review minutes range
- context percent saved range
- budget violation count
- repeated first-run blockers

Use the rollup to decide whether the next fix belongs in install, health, docs, routing, context budgets, or the template installer.
