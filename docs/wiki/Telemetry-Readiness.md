# Telemetry Readiness

Telemetry readiness is the point where Forgeflow can use local evidence to calibrate guidance without guessing from sparse history.

## Walkthrough

1. Run `/forgeflow-telemetry-quality`.
2. Check the trusted sources, weakest sources, confidence, and next quality action.
3. If the report names a missing stream, record the relevant local evidence first:
   - `/forgeflow-next-work-outcome`
   - `/forgeflow-learning-capture-nudge`
   - `/forgeflow-first-task-report`
   - `/forgeflow-first-run-result`
4. Rerun `/forgeflow-telemetry-quality`.
5. Run `/forgeflow-lean-prime` when lean context injection depends on telemetry readiness.
6. Treat low-confidence telemetry as advisory only. Do not cite it as performance evidence.

## Boundaries

The telemetry quality path reads local Forgeflow artifacts. It does not export telemetry, backfill missing outcomes, infer user preferences, call the network, commit, push, or publish evidence.

## Release Use

Before making lean or adoption claims, pair `/forgeflow-telemetry-quality` with `/forgeflow-lean-report --write` and model-backed benchmark evidence validated by `/forgeflow-lean-benchmark-results`.
