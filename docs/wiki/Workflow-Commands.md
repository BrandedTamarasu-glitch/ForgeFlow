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
| `/implement` | Execute the current brief with coordinated agents and maintain `.forgeflow/<project>/implementation-notes.md`. |
| `/review` | Review changed files with explainable routing and multi-agent synthesis. |
| `/review-auto` | Apply conservative safe fixes, then re-review. |
| `/audit` | Run a deeper systems/security/craft audit. |
| `/dashboard` | Start the optional local metrics dashboard on port 4003. |
| `/forgeflow-code-map` | Generate a compact project code map with topology, sections, changed-section hints, import-gap explanations, Git provenance, and generated artifact paths. |
| `/forgeflow-drift` | Check whether agent prompts have drifted from canonical shared intelligence references using the script-backed drift helper. |
| `/forgeflow-health` | Audit installation, project-local state, latest project-learning quality, and latest-insights readiness/freshness; can safely repair `.forgeflow/` scaffolding and budget config. Stale latest insights recommend `/forgeflow-trends --refresh`. |
| `/forgeflow-learnings --project --check` | Refresh and print current-project learnings, run the quality gate, smoke-test context-pack injection, and report whether latest insights are ready for agent context. Cross-project mode uses the pattern-learnings rollup helper across legacy learnings and project-learning candidates. |
| `/forgeflow-metrics` | Summarize telemetry, calibration, outcomes, context savings, budget health, and advisor actions. |
| `/forgeflow-pilot` | Print the repeatable maintainer pilot script and public-safe result template. |
| `/forgeflow-report` | Produce a script-backed status report including local metrics, false-positive thresholds, pattern freshness, context trends, project trends, import-gap status, latest-insights readiness/freshness, and direct next-action recommendations. Add `--refresh` to update project guidance first. |
| `/forgeflow-release-check` | Run local pre-release checks for command coverage, install, update, health, version, and context helpers. |
| `/forgeflow-smoke` | Run the local stabilization smoke path for health, trends refresh, report refresh, code map, doc links, and release-version guards. |
| `/forgeflow-trends` | Show the current project's code-map trend, import-gap status, artifact freshness, latest-insights readiness/freshness, project-learning consumption, and context-advisor status. Add `--refresh` to refresh project learnings and latest-insights readiness first; stale reports recommend it directly. |
| `/forgeflow-version` | Show installed commit, upstream status, latest release, helper paths, and the next update action. |
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
scripts/forgeflow/build-code-topology.js --json
scripts/forgeflow/show-code-map.js --json
scripts/forgeflow/build-memory-context.js --json
scripts/forgeflow/build-scope-manifest.js --json
scripts/forgeflow/record-implementation-notes.js --json
scripts/forgeflow/record-project-learning.js --json
scripts/forgeflow/check-implementation-notes.js --json
scripts/forgeflow/check-project-learnings.js --json
scripts/forgeflow/rollup-project-learnings.js --json
scripts/forgeflow/show-project-learnings.js
scripts/forgeflow/smoke-check.js --json
scripts/forgeflow/render-pilot-script.js --runtime codex
scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json
scripts/forgeflow/advise-context.js --root .forgeflow --record --json
```

These helpers produce bounded context packets, compact memory summaries, file ownership packets, budget warnings, trimming recommendations, and trend history.

## Implementation Notes

During `/implement`, Forgeflow keeps a local Markdown log at `.forgeflow/<project-name>/implementation-notes.md`. It captures decisions, spec gaps, tradeoffs, deviations, follow-ups, and validation notes that arise while building. See [Implementation Notes](Implementation-Notes) for the artifact contract and privacy rules.

For a Claude install created by `/update-forgeflow`, the helper root is:

```text
~/.claude/forgeflow/scripts/forgeflow/
```
