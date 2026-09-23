# Skill comparison protocol

`scripts/forgeflow/task-evaluation.js` now supports a separate skill comparison. Existing `plan` and `summarize` commands retain schema 1 and the `no-agent`, `single-agent`, `forgeflow` arms. Skill commands use schema 2 and `skill-disabled`, `skill-enabled`; these never enter workflow comparison totals.

## Frozen example

```sh
node scripts/forgeflow/task-evaluation.js plan-skill --input fixtures/atomicity/evaluation-manifest.json
node scripts/forgeflow/test-task-evaluation.js
node scripts/forgeflow/test-skill-evaluation.js
```

The [manifest](../fixtures/atomicity/evaluation-manifest.json) freezes six synthetic inputs, scoring criteria, provenance and SHA256 identities of the source and separate answer key. The regression test verifies those files and the complete protocol identity. Its 48 scheduled trials are all **unobserved**. Four repetitions per case give each of two arms two turns in each order position. This is a small pilot design, not a basis for statistical superiority claims.

The manifest is `fixture-only`: no model, settings, budget or implemented skill is claimed. It rejects actual observations. Review calibration remains planned. Deterministic operation tests establish the examples' expected behavior; they do not establish reviewer performance.

## Before a model pilot

Copy the protocol into local evaluation storage. Set `execution` to `model-ready`, select the implemented skill's exact revision and model identity, and freeze settings, budget, task baselines and scoring criteria before observing responses. Both arms must share model, settings and budget. Unknown measurements remain null; record actual configuration where available. Freeze a new protocol for any change, including procedure revisions. The protocol hash changes trial identities so old results cannot be merged into the new comparison.

Use fresh isolated baseline copies and independent conversations for every trial. Provide **only `trial.task.input`** as the task prompt, plus the chosen skill procedure for the enabled arm. Keep answer keys, scoring criteria, mechanisms, assertions and other trials out of the evaluated model's context and filesystem. The keys are public fixtures, so this is input separation, not a secrecy or contamination guarantee. The helper schedules and summarizes; it does not execute models, enforce filesystem isolation or attest that a runner followed the protocol.

The example's source is newly authored synthetic code under the repository MIT license, with no copied project or personal data. `source_revision` identifies its exact bytes; `answer_key_sha256` freezes the separate expected behaviors. New corpora must supply equivalent source/revision, license assessment, derivation and expected-outcome provenance. Hash metadata alone does not verify external files: perform the corpus checks before a pilot, as the atomicity regression test does.

## Recording outcomes

Call `summarize-skill --input <local-results.json>` with `{ "manifest": <frozen protocol>, "trials": [<submitted trial records>] }`. Keep actual trial logs local. Copy records from the generated schedule; only these fields may change:

- `observation`: `actual`, `fixture` or `unobserved`.
- `run_status`: `completed`, `failed` or `unobserved`. Unobserved status and observation must agree. A completed run can still fail its task.
- Metrics: `verified_completion` (boolean), `missed_defects`, `false_findings`, `regressions`, `tokens` (nonnegative integers), `human_correction_minutes`, `latency_ms`, `cost_usd` (nonnegative numbers). Every metric may be null when unavailable.

Score against the separate answer key after collecting the response. Failed executions stay in the schedule, with observed resource usage if available and unscored outcomes null. Record an observed task failure as `verified_completion: false`; do not turn unknown outcomes into zeroes. Use correction minutes only when observed, not an estimate derived from finding counts.

The summary retains all scheduled records, inserts omitted ones as unobserved, counts failed attempts separately for actual and fixture observations, and rejects duplicate, foreign or altered trial metadata. It reports actual and fixture metrics separately. Differences use complete pairs of the same observation type and mean enabled minus disabled; lower is preferable for defect/overhead counts. Unknown metrics do not enter means. Failure counts and missing runs must accompany those means to avoid reading a partial result as overall success.

The foundation itself contains no model observations. The subsequent [Phase 1 pilot](capability-pilot-results.md) records 32 actual supplied-evidence responses separately. Tests use synthetic records even when exercising the parser's `actual` branch. Skill benefit and activation readiness remain later roadmap work.

The subsequent [Phase 2 recovery/review pilot](recovery-review-pilot-results.md) adds 32 actual code-inspection responses and separate executed simulation checks. Equal outcomes do not establish benefit or activation readiness.
