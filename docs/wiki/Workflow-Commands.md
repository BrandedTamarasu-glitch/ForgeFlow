# Workflow Commands

Forgeflow can be used as a full lifecycle or as targeted commands.

## Lifecycle

```text
/discuss -> /research -> /plan -> /consult -> /implement -> /review -> /ship
```

## Common Commands

| Command | Purpose |
|---|---|
| `/discuss` | Frame the problem, user needs, constraints, and open questions. |
| `/research` | Evaluate options, prior art, codebase patterns, and risks. |
| `/plan` | Produce a phased implementation plan with validation criteria. |
| `/consult` | Produce an implementation brief across architecture, security, UX, and coordination. |
| `/implement` | Execute the current brief with coordinated agents. |
| `/review` | Review changed files with explainable routing and multi-agent synthesis. |
| `/review-auto` | Apply conservative safe fixes, then re-review. |
| `/audit` | Run a deeper systems/security/craft audit. |
| `/forgeflow-health` | Audit installation and project-local state; can safely repair `.forgeflow/` scaffolding and budget config. |
| `/forgeflow-metrics` | Summarize telemetry, calibration, outcomes, context savings, budget health, and advisor actions. |
| `/forgeflow-report` | Produce a broader status report including drift, context trends, and local metrics. |
| `/ship` | Prepare presentation, PR, CI checks, and release handoff. |

## Codex Skills

Codex users can invoke skills directly:

```text
$discuss
$research
$plan
$consult
$implement
$forge-review
$ship
```

## Context Helpers

The review and implementation skills use local helpers when available:

```bash
scripts/forgeflow/build-context-pack.js --json
scripts/forgeflow/build-memory-context.js --json
scripts/forgeflow/build-scope-manifest.js --json
scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json
scripts/forgeflow/advise-context.js --root .forgeflow --record --json
```

These helpers produce bounded context packets, compact memory summaries, file ownership packets, budget warnings, trimming recommendations, and trend history.
