# Lean Evidence

Forgeflow treats lean guidance as advisory until there is local evidence.

Use this path when you want proof instead of intuition:

1. Run `/forgeflow-lean-prime`.
2. Run `/forgeflow-lean-decision --task "<work item>"`.
3. Build and validate the change.
4. Run `/forgeflow-lean-report --write`.
5. Run `/forgeflow-lean-review` before normal review when the risk is over-building.
6. Use `/forgeflow-lean-lab --task-pack <json> --results <json>` for repeatable local comparisons.
7. Use `/forgeflow-lean-benchmark-runner --write` and validate model-backed results with `/forgeflow-lean-benchmark-results --results <json>`.

Do not publish performance claims from single samples, failed validation, missing correctness gates, or results without the session-cost caveat.
