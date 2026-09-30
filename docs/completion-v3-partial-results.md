# Stopped comparison v3: partial accounting

Date: 2026-09-30. **Stopped after scope correction to real GitHub PR validation; do not resume or replace attempts.** Of 36 planned slots, 22 finished, two were interrupted and twelve never launched. Finished outcomes: 16 passed, two acceptance failures, three stage-boundary failures and one timeout. Interruption is administrative, not evidence of a capability defect.

The [historical frozen design](../fixtures/completion-comparison-v3/protocol.json) used a reused actual-PR receipt case and two authored synthetic cases, with three evaluation stages. All five dispatch smokes remain excluded. The schedule and shared input hashes were unchanged at stop. Raw results and logs are preserved locally; the accounting below distinguishes completed, interrupted and unobserved outcomes without replacing records.

| Slot | Case | Variant | Arm | Outcome |
| --- | --- | --- | --- | --- |
| 1 | receipt-identity | defective | Recovery evaluation | Timeout |
| 2 | receipt-identity | defective | Baseline | Passed |
| 3 | receipt-identity | clean | Baseline | Passed |
| 4 | receipt-identity | clean | Recovery evaluation | Passed |
| 5 | receipt-identity | defective | Baseline | Acceptance failure |
| 6 | receipt-identity | defective | Recovery evaluation | Passed |
| 7 | receipt-identity | clean | Recovery evaluation | Passed |
| 8 | receipt-identity | clean | Baseline | Passed |
| 9 | receipt-identity | defective | Recovery evaluation | Passed |
| 10 | receipt-identity | defective | Baseline | Acceptance failure |
| 11 | receipt-identity | clean | Baseline | Passed |
| 12 | receipt-identity | clean | Recovery evaluation | Passed |
| 13 | publish-reconcile | defective | Baseline | Stage boundary failure |
| 14 | publish-reconcile | defective | Recovery evaluation | Passed |
| 15 | publish-reconcile | clean | Recovery evaluation | Passed |
| 16 | publish-reconcile | clean | Baseline | Stage boundary failure |
| 17 | publish-reconcile | defective | Recovery evaluation | Passed |
| 18 | publish-reconcile | defective | Baseline | Passed |
| 19 | publish-reconcile | clean | Baseline | Passed |
| 20 | publish-reconcile | clean | Recovery evaluation | Stage boundary failure |
| 21 | publish-reconcile | defective | Baseline | Passed |
| 22 | publish-reconcile | defective | Recovery evaluation | Passed |
| 23 | publish-reconcile | clean | Recovery evaluation | Interrupted at scope change |
| 24 | publish-reconcile | clean | Baseline | Interrupted at scope change |
| 25 | migration-fence | defective | Recovery evaluation | Unlaunched |
| 26 | migration-fence | defective | Baseline | Unlaunched |
| 27 | migration-fence | clean | Baseline | Unlaunched |
| 28 | migration-fence | clean | Recovery evaluation | Unlaunched |
| 29 | migration-fence | defective | Baseline | Unlaunched |
| 30 | migration-fence | defective | Recovery evaluation | Unlaunched |
| 31 | migration-fence | clean | Recovery evaluation | Unlaunched |
| 32 | migration-fence | clean | Baseline | Unlaunched |
| 33 | migration-fence | defective | Recovery evaluation | Unlaunched |
| 34 | migration-fence | defective | Baseline | Unlaunched |
| 35 | migration-fence | clean | Baseline | Unlaunched |
| 36 | migration-fence | clean | Recovery evaluation | Unlaunched |

## Interpretation limits

This is an incomplete study, not a randomized early-stopping result or a general benefit estimate. Publication claims have not completed independent adjudication. Receipt claims were checked against recorded evidence; two final implementations contain a reproduced blocking FIFO-open regression, and one fails malformed-ID rejection. Missing acceptance JSON in a failed attempt cannot be treated as all checks passing or as every defect being missed. Timing and cost comparisons are not qualified by this partial accounting.

The prepared publication and migration references have separately reproduced [post-freeze gaps](../fixtures/completion-v3-diagnostics/README.md). Publication shared-buffer aliasing violates capture and detached-return requirements; Error-stack equality is ambiguous. Migration overlap leaves local state usable after a failed reload, with an explicit task-applicability caveat, while its stale-write fence protects the durable document. An edit to these references alone cannot be counted as a false finding. Frozen outcomes are unchanged.

The receipt case was reused and smoke-tuned, the other cases are synthetic, and three stages do not qualify the full supported workflow. The partial observations do not support normal activation. All nine capabilities remain in evaluation. Continue with bounded real-PR validation and readiness assessment, preserving historical studies separately.
