# Quick Start

## Clone

```bash
git clone https://github.com/BrandedTamarasu-glitch/ForgeFlow.git
cd ForgeFlow
```

## Bootstrap State

```bash
scripts/forgeflow/ensure-forgeflow-state.sh
```

This creates local workflow state under:

```text
.forgeflow/<project-name>/
```

The state directory is ignored by git.

## Claude Code

Start with a review:

```text
/review
```

Or run the full workflow:

```text
/discuss -> /research -> /plan -> /consult -> /implement -> /review -> /ship
```

## Codex

Use the repo skills:

```text
$consult design the approach
$implement execute the brief
$forge-review review the current changes
$ship prepare the branch
```

## Useful Helpers

```bash
scripts/forgeflow/explain-review-route.js --json
scripts/forgeflow/summarize-calibration.js --json
scripts/forgeflow/record-review-outcome.js --summary .forgeflow/<project>/review-outcomes.jsonl --json
```
