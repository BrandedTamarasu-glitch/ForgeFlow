# Lean Evidence

Forgeflow treats lean guidance as advisory until there is local evidence.

Use this path when you want proof instead of intuition:

1. Run `/forgeflow-lean-prime --prime-task "<work item>" --write-report`.
2. If you did not prime the task in step 1, run `/forgeflow-lean-decision --task "<work item>"`.
3. Build and validate the change.
4. Run `/forgeflow-lean-report --write`.
5. Run `/forgeflow-lean-review` before normal review when the risk is over-building.
6. Use `/forgeflow-lean-lab --task-pack <json> --results <json>` for repeatable local comparisons.
7. Use `/forgeflow-lean-benchmark-runner --write` and validate model-backed results with `/forgeflow-lean-benchmark-results --promptfoo raw-results.json --out normalized-results.json`, then `/forgeflow-lean-benchmark-results --results normalized-results.json`. Model-backed runs also write a local benchmark run ledger for dashboard/readiness evidence.

Run `/forgeflow-stale-artifact-plan` after commits when latest project guidance or insights are stale; its post-commit aftercare commands keep Lean Prime and dashboard guidance current.

Do not publish performance claims from single samples, failed validation, missing correctness gates, or results without the session-cost caveat.
