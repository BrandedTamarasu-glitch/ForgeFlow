# Quick Start

## Clone

```bash
git clone https://github.com/BrandedTamarasu-glitch/ForgeFlow.git
cd ForgeFlow
```

## Claude Install

From Claude Code, run:

```text
/update-forgeflow
```

This syncs Claude agents, commands, hooks, templates, project rules, patterns, and runtime helpers into `~/.claude/`.
The updater is script-backed and pins downloads to the fetched commit SHA so the installed version file describes the files that were actually installed.

After installing or updating, restart Claude Code, then verify:

```text
/forgeflow-version
/forgeflow-health
```

For an existing local install, see [Migration Guide](Migration-Guide).

Runtime helpers are installed at:

```text
~/.claude/forgeflow/scripts/forgeflow/
```

Set a helper root before running project-local helpers:

```bash
HELPER_ROOT="scripts/forgeflow"
if [ ! -x "${HELPER_ROOT}/ensure-forgeflow-state.sh" ]; then
  HELPER_ROOT="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
```

## Bootstrap State

```bash
${HELPER_ROOT}/ensure-forgeflow-state.sh
```

This creates local workflow state under:

```text
.forgeflow/<project-name>/
```

The state directory is ignored by git.

Audit and repair missing project-local state:

```bash
${HELPER_ROOT}/health-check.js --fix --json
```

Seed context budget config without overwriting an existing file:

```bash
${HELPER_ROOT}/seed-budget-config.js --json
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

If you installed through `/update-forgeflow` and do not have a local checkout, replace `scripts/forgeflow/` with:

```text
~/.claude/forgeflow/scripts/forgeflow/
```
