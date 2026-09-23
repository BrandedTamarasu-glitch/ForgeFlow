# Revised repository-task evaluation

Date: 2026-09-23. **No accuracy advantage over baseline was observed. The full procedure and baseline tied on both the frozen checks and a separate diagnostic. The intended clean control also proved incomplete, so its source edits cannot be scored as false positives.**

This follow-up preserves the original [Phase 1](capability-pilot-results.md) and [Phase 2](recovery-review-pilot-results.md) results. It changes evaluation tasks rather than replacing old scores.

## Method

The [frozen protocol](../fixtures/recovery-workbench/protocol.json) scheduled 18 actual trials: two repository versions, three repetitions each, and baseline, short-checklist and full-procedure arms. Order rotated so each arm occupied each position once per version. Each trial used a fresh context, inherited model/settings without overrides, and an isolated copy of the same small multi-file repository. Trials inspected source, could repair two specified modules and add tests, and reported their validation. They received no hidden checks, expected defect counts or corrected source.

The common task, instructions and budgets were fixed before execution. The limit was 12 task tool calls plus the initial prompt read, and a 200-word final report, enforced by instruction. File boundaries were instructional, not OS isolation; access adherence was not independently audited. Exact model identity, sampling parameters, tokens, model latency, cost and correction time were unavailable.

The hidden acceptance runner received submitted source and a frozen backend, with no arm label. Its eight checks covered reopening, concurrent accepted saves, duplicate delivery, publication during cleanup, migration, unsupported-schema no-write behavior, removal failure and orphan collection. The original defective source failed two checks; the intended clean control passed all eight before trials. No hidden-check results were sent back to trial contexts. All 18 attempts completed and were retained without replacements or omitted failures. Fixed repository files were unchanged in all submitted copies.

## Frozen outcomes

| Arm | Defective-version complete repairs | Intended-control acceptance passes | Intended-control source edits | Mean prepared prompt bytes |
|---|---|---|---|---|
| Baseline | 3 / 3 | 3 / 3 | 2 / 3 | 884.33 |
| Short checklist | 3 / 3 | 3 / 3 | 1 / 3 | 1,406.5 |
| Full procedure | 3 / 3 | 3 / 3 | 2 / 3 | 6,126.5 |

Each completed submission passed all eight checks: 144 check outcomes in total. These are repeated observations on two underlying versions, not 144 independent tasks. Prompt bytes include task/treatment text and the workspace reference, excluding common host instructions and transport. Small path-length differences are included. They are not token, cost or efficiency measurements.

The prespecified exploratory trigger required at least two additional complete repairs out of three versus baseline, all controls passing without source edits, and no formerly passing check regressing. No arm met it. Consequently the conditional retest of all previously trialed capabilities was not launched. The standing scope includes persistence recovery, review calibration, change propagation and visual acceptance if a future valid comparison supports benefit.

## Control flaw and post-freeze diagnostic

A baseline trial repaired a read/reclamation race in the intended clean control. Independent execution reproduced it: a reader selects generation g0; another shelf publishes g1 and reclaims g0; reading the selected generation throws `missing generation` despite valid committed data. The eight frozen checks omitted this schedule. See [the reproducible diagnostic](../fixtures/recovery-workbench/diagnostic.js).

We retained the control, protocol and primary scores unchanged and evaluated this new schedule separately after trial completion. This diagnostic was not predeclared and is not a new primary score:

| Arm | Diagnostic passes across all six submitted copies | Passes on the three intended-control copies |
|---|---|---|
| Baseline | 5 / 6 | 2 / 3 |
| Short checklist | 4 / 6 | 1 / 3 |
| Full procedure | 5 / 6 | 2 / 3 |

Thus fewer control edits did not imply better judgment: some unchanged copies retained a reproducible race. The no-edit control criterion cannot establish false-positive performance here. The diagnostic is exploratory and too small to establish inferiority of the checklist or equivalence of the full procedure and baseline.

## Decision and limits

Keep all four implemented capabilities in evaluation. This experiment provides concrete repair artifacts and exposes a coverage gap, but it still has a ceiling on its primary checks and no full-procedure advantage. It does not justify rollout, procedure removal or a claim that the capabilities cannot help on other work. The abbreviated checklist is not qualified as a replacement either.

Before another benefit study, independently challenge the candidate clean controls, include the discovered read schedule, and select varied held-out tasks with independently checked acceptance criteria. Freeze the revised cases before collecting outputs and preserve this result. Do not keep changing cases until a preferred arm wins. Real backend durability, graphical recovery UX and broad repository discovery remain untested.

Validation: `node scripts/forgeflow/test-recovery-workbench.js` passed for frozen hashes, isolated counterbalanced preparation and the original behavioral checks. `node fixtures/recovery-workbench/diagnostic.js` reproduced the control failure separately. Trial source, prompts, scoring records and report summaries remain in ignored local evidence storage; only synthetic fixtures and aggregate results are published in source. No preview server or production data was used.
