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

Audit and repair missing project-local state:

```bash
scripts/forgeflow/health-check.js --fix --json
```

Seed context budget config without overwriting an existing file:

```bash
scripts/forgeflow/seed-budget-config.js --json
```

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
scripts/forgeflow/build-context-pack.js --json
scripts/forgeflow/build-memory-context.js --json
scripts/forgeflow/build-scope-manifest.js --json
scripts/forgeflow/summarize-context-telemetry.js --root .forgeflow --json
scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json
scripts/forgeflow/advise-context.js --root .forgeflow --record --json
```
