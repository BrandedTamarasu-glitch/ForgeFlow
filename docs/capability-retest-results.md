# Four-capability real-project retest

Completed 2026-09-23: all 24 reviews finished within the frozen limits. The added procedures produced limited discovery gains on these selected changes, with complementary misses and no calibration advantage. Earlier evaluations remain unchanged.

## Frozen method

Twenty-four independent reviews cover four comparisons, each with three baseline and three enhanced runs. Enhanced receives exactly one complete capability procedure. Both arms receive the same existing review guidance within a case, model setting, source snapshots, task, tools and budget. The portfolio comparison uses frontend guidance; the others use systems guidance. This measures one review pass, not the complete ForgeFlow workflow.

| Capability | Source | Head | Base | Limit per review |
|---|---|---|---|---|
| Persistence recovery | [Baa-ton PR 3](https://github.com/zachristmas/baa-ton/pull/3) | `0c74eb02b84948a8a9b23895eb039750a998857e` | `51c9d599bd20bddfbcba6f4d5d86cae54f86d329` | 480 seconds |
| Change propagation | [baa-ton-forge PR 32](https://github.com/BrandedTamarasu-glitch/baa-ton-forge/pull/32) | `3da657e46b233da86ce915f9eeb3fb0d743dc238` | `342be4185890edd2292c35fa0ef704ff64789256` | 480 seconds |
| Visual acceptance | [Portfolio redesign](https://github.com/BrandedTamarasu-glitch/BrandedTamarasu-glitch.github.io/commit/5d9dd88d5c87ded0519bd8371509df62be7761a7) | `5d9dd88d5c87ded0519bd8371509df62be7761a7` | `f1164ca95ca5bc0bf2ca42fbc80bd037939029c6` | 720 seconds |
| Review calibration | [Known ledger change](https://github.com/BrandedTamarasu-glitch/WarmLedger/commit/c41b4f1d2c6c13740a25bda3848969ca7b525382) | `c41b4f1d2c6c13740a25bda3848969ca7b525382` | `1c7f25f3658726d8254f5f8b91db0d1150aed953` | 720 seconds |

Discovery snapshots were not used in the previous twelve-review comparison. This does not imply they were unfamiliar to the project author. Calibration deliberately reuses verified defects and counterexamples from that comparison, with four claims and a hidden key. It measures adjudication, not new discovery. Its controls were qualified by independent source inspection and executable browser reproduction during the earlier comparison; there was no separate second-person control review for this round.

The configured model is `gpt-6-astra`, with fresh ephemeral CLI contexts, no user configuration, no reasoning override, and two concurrent processes. Exact backend settings and equivalence to the interactive host remain unverified. Each review has 48 tool events and 2,000 final words. Pair order alternates and is balanced across the four cases. Instructions forbid external network access, peer evidence, original checkout access and source edits; only owned reproduction artifacts are permitted. Filesystem isolation is instructional, with source and added-file audits.

Inputs, source, prompts, key and scoring criteria were frozen before responses. Protocol SHA-256: `f8e8edf664c66b5db2d23f46ada8f3c69db6466983bd8fc19c765f95d1c67f81`. Failed, missing, malformed and over-budget attempts remain visible without replacement. All outputs are collected before findings are anonymized for independent adjudication. Arm mapping is opened only after claim dispositions are recorded.

Discovery has no exhaustive answer key: unique verified introduced defects, repeatability, unsupported claims and unresolved claims are reported without overall accuracy or recall. A finding present in at least two enhanced runs and no baseline run supplies replicated case-specific evidence; the reverse is reported equally. Calibration separately reports keyed dispositions, misses, accepted unsupported claims, severity and unresolved assessments. These small, selected tasks cannot establish general benefit or justify normal automatic activation.

Repeated runs of one change measure variability on that change, not breadth across projects. The baseline already includes extensive review guidance, so this comparison tests the marginal value of an added procedure. Supplied calibration claims narrow the search substantially and may create another ceiling; calibration results cannot establish open-ended discovery ability. Injecting the calibration procedure into one reviewer tests claim judgment, not the procedure's full experiment-design and post-review orchestration role. Real browser checks are possible but are not equivalent to assistive-technology or human visual testing.

## Environment checks

The portfolio's existing accessibility and PDF checks pass. The archived recovery integration test cannot start without its absent `jiti` dependency; its recovery module can be exercised directly. The integration snapshot passes 179 of 180 existing tests outside the managed sandbox; one assertion expects different error wording. The same assertion fails on the base revision, establishing that this test failure predates the selected change. Inside the sandbox, four test files fail. These are environment/preflight observations, not automatically introduced defects. Any additional execution limits are retained with results.

## Discovery results

All eighteen discovery reviews were eligible. Fifty claims across the complete experiment reduced to twelve independently verified discovery mechanisms plus two known calibration defects. No submitted claim was adjudicated unsupported or unresolved. Unknown defects remain unknown; this is not an overall accuracy or recall estimate.

| Added procedure | Baseline verified findings per repetition | Enhanced verified findings per repetition | Distinct mechanisms, baseline / enhanced |
|---|---|---|---|
| Persistence recovery | 2, 2, 2 | 2, 2, 2 | 3 / 2 |
| Change propagation | 2, 3, 2 | 2, 3, 3 | 3 / 4 |
| Visual acceptance | 1, 1, 2 | 2, 2, 3 | 3 / 4 |

Across the nine discovery reviews per arm, enhanced produced **21 verified finding occurrences versus 17 baseline**, and **10 distinct mechanisms versus 9 baseline**. The union contains twelve mechanisms. These totals combine different tasks and procedures; they do not establish a general treatment effect.

Visual acceptance found one more verified issue in each paired repetition on this portfolio change. Recovery supplied the first replicated enhanced-only discovery in these evaluations: retained historical bindings prevent a second root recovery, found in **3/3 enhanced and 0/3 baseline**. The reverse also occurred: the MCP session-path integration problem appeared in **2/3 baseline and 0/3 enhanced**. Recovery's total findings tied, while baseline covered more distinct mechanisms. Change propagation's additional setup/consumer incompatibility appeared once, not repeatedly.

| Verified mechanism | Baseline runs | Enhanced runs | Evidence and scope |
|---|---:|---:|---|
| Recovery leaves nested goal ownership stale | 3/3 | 3/3 | Actual migration and controller reload change an existing goal from selected to absent; a no-stale-turn control remains selected. |
| Recovery cannot repeat with retained workflow history | 0/3 | 3/3 | Commit and reload migration A to B, then attempt B to C: preserved original task binding fails the new owner check. |
| Recovery rejects the standard MCP context's absent session-path variable | 2/3 | 0/3 | Actual extracted bridge context and recovery guard reject a correct synthetic native path until the missing environment value is supplied. Full live provider recovery was not exercised. |
| Recovery compares identity by JSON property order | 1/3 | 0/3 | Actual normalization changes property order; equal field values pass the existing comparator but fail the new serialized comparison. |
| Integration leaves unrelated tools blocked after an unresolved handoff | 3/3 | 3/3 | Interrupted and pre-call-drift schedules keep ordinary reads blocked after turn end and reload. The audit slash command remains available. |
| Integration checks another repository's dependency in the destination repository | 3/3 | 2/3 | Real disposable repositories reproduce rejection; existing preparation accepts the same dependency evidence. |
| Integration rewrites literal POSIX backslashes into another checkout path | 1/3 | 2/3 | The generated command advances the wrong disposable worktree if executed. Native approval was simulated, so this establishes a wrong proposed target, not an approval bypass. |
| Guided setup creates detached reviewers that guided integration rejects | 0/3 | 1/3 | Actual setup creates the detached worktree; the new consumer requires a named branch. This is a composed-workflow incompatibility, not a claim that arbitrary detached targets must be accepted. |
| Enlarged hero text expands its grid beyond the viewport | 2/3 | 3/3 | At 390px with 32px default text, the lead spans 468px. A DOM-only wrapping control reduces it to 335px. |
| Case-study metrics overflow near their stacking breakpoint | 1/3 | 2/3 | At 581px and normal text size, the final metric extends beyond the viewport; base stacks the metrics. |
| Focused skip-link text disappears on hover | 1/3 | 1/3 | Native keyboard/pointer input gives the new link identical foreground/background colors; base retains contrast. |
| Enlarged mobile navigation loses local scrolling | 0/3 | 1/3 | Head navigation overflows without local scrolling; base allows local scrolling. Verified separately from the hero width defect. |

Verification used clean snapshot copies, source-contract inspection, inspected and rerun reproduction scripts, actual controller/adapter entry points, disposable Git repositories, and an independently written Chromium harness. Browser screenshots and measured geometry support the visual dispositions. Some base pages already overflow in other regions; those pre-existing problems are not counted. The recovery module is new, so introduction is established through its new behavior and existing producer/consumer contracts rather than an equivalent recovery command on base.

All claim dispositions were saved before opening arm mapping. Adjudication SHA-256: `66e567c7cc0a57e9655015ea6f9259e7a90e82605463f3355480a86a82c21a0e`. Arm labels were hidden during adjudication; this is not a claim of independent institutional or perfect double-blind review. No historical saved-review miss is established for these new discovery cases. Later fixes and current upstream behavior were not assessed.

## Calibration results

Each arm correctly assessed all four supplied claims in all three runs: **12/12 claim dispositions per arm**, six matched defect occurrences, zero missed defects, zero accepted unsupported claims and zero unresolved assessments. Explanations matched the qualified mechanisms and browser observations.

Both arms disagreed identically with the frozen severity key. All six reviews classified malformed-backup startup failure as high rather than medium, and temporary scenario-draft loss as medium rather than low. This yields **six severity overstatements per arm under the frozen rubric**, and no overall calibration pass. The key remains unchanged. Unanimous disagreement warrants scrutiny of the severity rubric/key; it is not evidence that enhanced performs worse or better. Treating the alternate severities as acceptable in a future version would still leave both arms tied. Do not silently rescore this version.

These explicit, familiar claims again produced a disposition ceiling. They provide no evidence of improved open-ended discovery or full calibration-workflow quality.

## Execution and overhead

All 24 attempts completed in 24 distinct contexts. There were no timeouts, source-boundary violations, malformed review responses, incomplete calibration assessments, or tool/word-budget overruns. Frozen input hashes and equal paired source snapshots were checked. The reporting helper initially displayed an incorrect planned total due to a string-replacement typo; it was corrected to the actual frozen 24-slot queue before this report. No schedule, attempt or score changed.

| Case | Mean baseline / enhanced seconds | Baseline / enhanced prompt bytes |
|---|---:|---:|
| Recovery | 217.7 / 246.5 | 30,875 / 36,087 |
| Propagation | 187.6 / 213.6 | 30,875 / 35,663 |
| Visual | 343.4 / 403.7 | 26,024 / 30,345 |
| Calibration | 228.3 / 196.7 | 31,075 / 35,959 |

CLI usage reports 23,909,391 input tokens, including 22,006,528 cached input tokens, and 161,530 output tokens. Reported reasoning output is 33,669 tokens and is not added again to output. Baseline/enhanced input totals are 12,278,973 / 11,630,418, and output totals are 77,736 / 83,794. Wall time includes tool execution and orchestration within each review; it is not isolated model latency. Parent preparation, verification, reporting and correction time are excluded. Exact monetary cost remains unknown.

## Decision and next step

The earlier synthetic ties did not prove that the procedures had no value. This real-project retest demonstrates limited added discovery, most consistently for visual acceptance on this one redesign and for a repeated-recovery mechanism. It also demonstrates complementary baseline strengths. A single universal accuracy claim would overstate the evidence.

The requested retest of all four earlier capabilities is complete. Preserve all earlier results and keep normal automatic activation gated. F4.1 benchmark verification is the next implementation item. Future benefit qualification needs varied new cases, independently challenged controls, and review of the severity key before another calibration experiment; no additional model runs are scheduled here. Application fixes, public issue reports, push and deployment were not performed.
