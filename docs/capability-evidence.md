# Capability evidence consolidation

Later checkpoint: [F6.1 final checks](completion-workflow-qualification.md) close bounded measurement and supported-workflow qualification. The open acceptance conclusions below describe this eight-study checkpoint; its ledger, scores and limits remain unchanged. All nine capabilities remain in evaluation.

Updated 2026-09-30. **Eight completed Phase 1–5 studies account for 178 scheduled trials: 177 completed responses and one retained interruption.** This is response accounting, not an accuracy rate. The [structured ledger](capability-evidence.json) links every study to its source report and preserves unmeasured values as null. Each source report is pinned by SHA-256 to the published `0e30f03` checkpoint.

F6.1 consolidation is complete, but **F6.1 acceptance remains open**. None of these eight studies measured correction time or compared the full automatically selected workflow through verified completion. All nine procedures remain in evaluation. Historical protocols, scores, severity keys and activation settings are unchanged. The separate [actual-PR completion follow-up](completion-pilot-results.md) records the later multi-stage workflows; its counts are not pooled into this ledger.

## Study ledger

| Study | Scheduled / completed responses | What the comparison measures | Result and important limit |
|---|---:|---|---|
| [Phase 1](capability-pilot-results.md) | 32 / 32 | Interpretation of supplied branding/layout evidence; four repeats | Both procedures 8/8 correct per arm. Observations were supplied, bypassing discovery and browser use. |
| [Phase 2](recovery-review-pilot-results.md) | 32 / 32 | Supplied recovery code and review judgments; four repeats | Both procedures 8/8 correct per arm. Explicit contracts and schedules produced another ceiling. |
| [Recovery workbench](recovery-workbench-results.md) | 18 / 18 | Repairs to a synthetic repository; three repeats, three arms | All submissions pass eight frozen checks. Intended clean control has an uncovered read race, invalidating no-edit false-positive inference. |
| [Provider/release](provider-release-pilot-results.md) | 36 / 35 | Synthetic provider, web and installed-command repairs; two repeats, three arms | Baseline/full 6/6 defective repairs each. Checklist 4/6 under ambiguous 304/MIME precedence; one control interrupted. Neither discrepancy is evidence of a full-procedure gain. |
| [Initial real-project study](real-project-review-results.md) | 12 / 12 | Discovery on two PRs and a ledger commit; two repeats | Five confirmed occurrences and three distinct mechanisms per arm; one exclusive mechanism each. Seven other claims remain unresolved. Ledger receives three procedures together. |
| [Four-capability retest](capability-retest-results.md) | 24 / 24 | Eighteen discovery reviews and six keyed calibration reviews; three repeats | Discovery: enhanced21/baseline17 occurrences, 10/9 distinct. Visual and a repeated-recovery mechanism show case-specific gains; baseline has complementary finds. Calibration dispositions tie, with equal severity-key disagreements. |
| [Benchmark](benchmark-cpu-pilot.md) | 12 / 12 | Discovery on two published benchmark changes; three repeats | Baseline10/enhanced7 occurrences, 4/3 distinct mechanisms. Favors baseline on these cases. CPU speed measurements are separate engineering evidence. |
| [Domain](domain-pilot-results.md) | 12 / 12 | Discovery on money migration and local CAD generations; three repeats | Primary money defect baseline3/enhanced1 occurrences; separate concurrency finding3/3 each. CAD zero-claim tie with correct evidence boundaries. No physical qualification. |

The denominator excludes abandoned proposals, deterministic checks, CPU samples, independent verification and control-preflight passes. The recovery read-race diagnostic and matching-MIME diagnostic rescore existing submissions; neither adds new trials. “Completed” means a returned response, not that its repair passed: provider/release has 35 completed responses but 33 slots passing full frozen acceptance, two ambiguous failures and one interruption. Counts must not be silently interchanged.

## Evidence by capability

These are consolidation assessments for the later F6.2 readiness decision, not promotions.

| Capability | Strongest available signal | Counterevidence or gap | Current implication |
|---|---|---|---|
| Change propagation | Retest: enhanced8/baseline7 occurrences, 4/3 distinct; one enhanced-only setup/consumer incompatibility | Extra mechanism appears once; earlier supplied evidence ties; broad consumer/repair completion unmeasured | Limited single-case signal; retain evaluation |
| Visual acceptance | Retest: enhanced `[2,2,3]`, baseline `[1,1,2]`; actual browser reproductions | One redesign, not three independent projects; no measured correction time or complete accessibility qualification | Most consistent observed occurrence gain; needs broader completion evidence |
| Persistence recovery | Repeated-recovery failure found 3/3 enhanced versus 0/3 baseline | Total occurrences tie6/6; baseline finds other defects, including a 2/3 versus 0/3 mechanism. Synthetic repair ties and flawed control | Complementary discovery, not uniformly stronger coverage |
| Review calibration | Known-claim dispositions 12/12 per arm | Six identical severity-key disagreements per arm; full calibration workflow not tested; key remains frozen | No observed advantage; independently reassess the rubric before a new version |
| Provider compatibility | Both baseline/full solve all provider tasks in the task pilot | Two repeats, synthetic provider boundary; no isolated real-project discovery/completion comparison | No demonstrated incremental benefit |
| Release qualification | Baseline/full tie on web and installed-command tasks; real browser/Linux fixture evidence exists separately | Ambiguous 304/MIME oracle; two repeats; no model-benefit qualification on actual deployment; platform gaps remain | Functionality evidence exists, benefit unproven |
| Benchmark verification | Real source reviews reproduce four actual problems | Baseline10/enhanced7 occurrences and 4/3 distinct; hardware unavailable; CPU fixture improvement is not model improvement | Baseline-favoring case evidence; retain evaluation |
| Money/calendar correctness | Both arms find the same representation defect on real source | Baseline3/3 versus enhanced1/3; other concurrency finding ties; real recurrence/DST not tested | No demonstrated benefit; preserve the lower enhanced detection frequency |
| CAD/fabrication acceptance | All six real-project reviews maintain digital/slicer/physical boundaries; digital artifacts independently checked | No defect claims, unknown detection sensitivity, shared instructions already require those boundaries; no physical tests | No demonstrated benefit or physical acceptance |

Every study tests incremental help over its stated baseline, not “ForgeFlow versus no ForgeFlow.” Baselines often already contain substantial review guidance. Finding an issue in an established PR demonstrates useful review capability; only a controlled difference attributable to the treatment supplies evidence of added value. A defect absent from a saved audit is a separate historical observation, not proof of treatment superiority or that the problem remains unfixed.

## Why the studies cannot be pooled into accuracy

- **Different outcomes:** snapshot interpretation, frozen-check repairs, open-ended discovery and keyed severity judgment have different denominators. Unknown defects in real discovery cannot become zero missed defects.
- **Different treatments:** the initial ledger study combines three procedures; the later retest isolates them. Generic review guidance also differs by task. Repetitions of one change measure variability, not additional project breadth.
- **Controls and keys:** the workbench control had a real race; the release oracle has unresolved precedence; calibration's severity key is disputed. Preserve original scores and label later diagnostics separately. Do not pick whichever version favors the treatment.
- **Configuration and isolation:** fresh contexts and equal within-study inputs were used, but inherited versus CLI environments are not proven equivalent. Exact backend/sampling is unavailable. Read boundaries are instructional; source hashes do not audit every read. Two studies use two rather than three repeats per case.
- **Negative findings:** CAD zero claims do not prove clean geometry or adequate sensitivity. No unsupported claims among submitted findings does not establish a global zero false-positive rate, especially when unresolved claims exist.

## Available measurements and missing acceptance

| F6.1 requirement | Evidence now available | Remaining gap |
|---|---|---|
| Frozen criteria and all scheduled outcomes | Eight source reports preserve primary outcomes, failures, separate diagnostics and keys; ledger reconciles178 slots | Historical validity issues remain; they cannot be fixed by relabeling old results |
| Identical isolated baseline, fixed settings/budget, counterbalanced order | Within-study copied inputs/fresh contexts and arm order recorded | Exact backend/sampling/read isolation incomplete; provider/release and initial real study have only two repeats |
| Verified completion | Frozen repair acceptance and complete discovery reports recorded separately | No paired measurement of automatically selected workflow through final verified deliverable |
| Missed defects and false findings | Keyed supplied cases and calibration; reproduced discovery claims and unresolved dispositions | No exhaustive discovery key; control edits cannot substitute for false findings |
| Observed correction time | None | Unobserved in all eight studies; review duration is not correction time |
| Available latency/cost | Four CLI studies report process wall times and token usage; other studies do not reliably instrument them | Process time includes startup/tools/waits; coordination/verification overhead excluded; monetary cost and pure model latency unavailable |

Published CLI usage is available in the provider/release, initial real-project, four-capability retest and benchmark reports. Cached input is a subset of reported input and must not be added again; reasoning output must not be added again to total output. These totals exclude preparation and verification. No aggregate cost or efficiency winner is computed. The domain pilot's file-access-time-derived elapsed value remains excluded, not replaced with an invented duration.

The remaining acceptance gap is substantive. F6.1 stays unchecked. The later [F6.2 readiness assessment](capability-readiness.md) retains all nine capabilities in evaluation; The later [F6.3 integration verification](capability-integration.md) is complete for the evaluation cohort; The [F6.4 source-release preparation](capability-release-preparation.md) is complete; F6.1 qualification and packaged-release gates remain open. No catalog availability or automatic-execution flag changes follow from this document.

## Requirements used for the completion follow-up

The consolidation called for a **real-project repair/completion comparison with measured correction time**. The requirements below guided the later frozen pilot. They remain requirements for a valid follow-up, not an authorization for additional trials.

1. Select a bounded real change with a concrete user-visible deliverable, adequate dependencies and independently reproducible acceptance. Prefer a fresh task rather than a third supplied-evidence judgment. If a known historical defect is used, label it a known-defect repair and do not count it as novel discovery. Choose by relevance/testability before outcomes; preserve negative cases.
2. Use equal base snapshots, tasks, tools and budgets, with at least three counterbalanced pairs. Record the actual selected capability and its reason. Establish a replayable treatment boundary in the supported workflow; no hand-inserted full procedure may be advertised as normal automatic activation. Keep production activation gated during evaluation.
3. Challenge both a legitimate clean case and a defective path independently before freeze. Include checks for collateral regressions and meaningful completion, not just changed files or a successful command. Fix ambiguous acceptance and freeze expected outcomes before trials. Missing physical/hardware evidence stays pending.
4. Instrument monotonic review/repair intervals, validation attempts, final acceptance, usage and observed limits. Define **initial completion time** from task start to the first submission, and **correction time** from a recorded validation failure to the first passing resubmission. Give both arms the same feedback policy. If no failure occurs, correction time is `not_applicable`, not zero. If no correction is attempted or observed, use `unobserved`; a timeout is a censored failed attempt, not a successful duration. Freeze limits on correction cycles.
5. Record unsupported blockers, verified regressions and required follow-up work alongside completion and time. Retain every launched attempt. Do not improve a passing rate by dropping an interruption or replacing an inconvenient control after observation. Assess each case first; report no broad accuracy claim from a tiny sample.

The [original actual-PR completion follow-up](completion-pilot-results.md) remains preserved with its execution limitations. The separate [automated comparison](completion-auto-results.md) now accounts for twelve workflows: baseline6/6 verified, added recovery3/6, two timeouts and one usage-limit interruption. Three successful corrections are measured. The administrative six-day usage pause is not part of the test and is excluded from all timing measures.

Two gaps in the authored control were reproduced after observation: a path mislabeled as a Pi ID bypassed validation, and a canonical native path alias was rejected. Both arms found the first case; baseline also repaired the second. The original scores remain unchanged. This does not establish added-recovery benefit, and control edits cannot measure false positives. The eight-study counts and pinned reports above remain unchanged; no new workflow count is pooled into their response denominator. F6.1 acceptance remains open and all nine capabilities remain in evaluation. Next: address control coverage, legacy compatibility and bounded recovery work before a newly frozen comparison.
