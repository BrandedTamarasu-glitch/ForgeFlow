# Telemetry Readiness

The command names below are Claude Code entrypoints; Codex users can use the corresponding [runtime helpers](Workflow-Commands.md#choose-your-host). Missing optional history on a fresh install is informational. It becomes evidence through completed work and explicit, truthful capture.

Telemetry readiness is the point where Forgeflow can use local evidence to calibrate guidance without guessing from sparse history.

## Walkthrough

1. Run `/forgeflow-telemetry-quality`.
2. Check the trusted sources, weakest sources, confidence, and next quality action.
3. If the report names a missing stream, inspect the capture recommendation and record evidence only after the corresponding event occurred:
   - `/forgeflow-next-work-outcome`
   - `/forgeflow-learning-capture-nudge` suggests a capture command; it does not record an outcome.
   - `/forgeflow-first-task-report` summarizes existing evidence; it does not create a completed task.
   - `/forgeflow-first-run-result`
4. Rerun `/forgeflow-telemetry-quality`.
5. Run `/forgeflow-lean-prime` when lean context injection depends on telemetry readiness.
6. Treat low-confidence telemetry as advisory only. Do not cite it as performance evidence.

## Boundaries

The telemetry quality path reads local Forgeflow artifacts. It does not export telemetry, backfill missing outcomes, infer user preferences, call the network, commit, push, or publish evidence.

## Release Use

Before making lean or adoption claims, pair `/forgeflow-telemetry-quality` with `/forgeflow-lean-report --write` and model-backed benchmark evidence validated by `/forgeflow-lean-benchmark-results`.

## Dashboard Evidence

[Review Outcomes and Review Trends](Dashboard.md) need real saved verdict telemetry; triaged outcome records separately support review-quality analysis and project learning. Review history is the shipping handoff record. These sources are related but are not interchangeable. Live Activity comes from the local activity service and reports events as they arrive, rather than reconstructing all prior sessions from review files.

An empty chart, missing optional benchmark, or absence of historical activity is not proof of a broken install. Check the panel's scope, source, and connection status, then perform a real workflow. Do not seed passing reviews, invented timing, or synthetic outcomes to clear readiness information.
