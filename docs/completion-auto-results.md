# Automated actual-PR completion comparison

Updated 2026-09-30. **All twelve workflows are accounted for: nine verified completions under the frozen checks, two timeouts and one usage-limit interruption. Baseline completed 6/6; added recovery completed 3/6.** The smoke workflow, original pilot and earlier eight-study ledger remain separate. [Structured results](completion-auto-results.json).

## Frozen scope

The case remains [Baa-ton PR #6](https://github.com/zachristmas/baa-ton/pull/6), head `2bbb198b7a5852cd64fc243a1392cda56f517640`, base `51c9d599bd20bddfbcba6f4d5d86cae54f86d329`. It is known-defect repair plus an authored corrected control, not discovery. The external acceptance remains the same 21 checks. Head, corrected and incomplete-fix preflight results remain 19/21, 21/21 and 20/21 respectively.

A separate smoke workflow exercises automatic stage handoffs, real controller tests and external verification. It is excluded from the comparison denominator. The [frozen comparison](../fixtures/completion-auto/protocol.json) has twelve fresh workflows: defective/corrected source, normal/added persistence-recovery guidance, three repetitions per combination and counterbalanced pair order. Initial work has 600 seconds, one correction cycle has 360 seconds, and external acceptance has 30 seconds. Two workflows run at a time. Source, task, base instructions, tools and limits match within each source variant.

The [automated runner](completion-runner.md) changes dispatch to the installed Codex CLI, captures final reports directly and enforces deadlines with subprocess supervision. Three fresh contexts execute the sequential stages; correction reuses those exact contexts. Short absolute temporary paths and explicit disposable-socket permission remove known setup obstacles. Workspace sandboxing stays enabled. Automatic confirmation prompts are disabled; a denied action remains a failure rather than triggering sandbox bypass.

Both arms use the same CLI invocation with user configuration and execution rules excluded. No explicit model or reasoning override is supplied. All 36 recorded contexts name `gpt-6-astra`; reasoning effort is unspecified. Exact backend internals/sampling are unknown; do not assume equality with the earlier in-session pilot. The prescribed controller command uses the same Node test suite with isolation disabled and TAP output for visible diagnostics. These dispatch and environment changes mean before/after wall times cannot establish a pure runner speedup or a change in capability accuracy.

The selector treatment remains an explicit source-grounded evaluation assessment after wording-only routing skipped all capabilities. Only the implementation stage receives the extra recovery procedure. Later stages receive its concrete evidence through the same report handoff. This does not qualify normal automatic selection or activation.

## Primary results

| Source variant | Baseline | Added recovery |
|---|---|---|
| Defective source | 3/3 verified; one first-pass, two corrected | 0/3 verified; two timeouts, one usage interruption during correction |
| Authored corrected control | 3/3 verified on first submission | 3/3 verified; two first-pass, one corrected |

The usage interruption stays in scheduled accounting and is **not a capability failure**. It is not replaced or retried. The six-day gap was an administrative pause caused by exhausted usage, **not part of the test**, and contributes no completion, correction or latency time. The first four slots ran on September 24; only the untouched eight continued on September 30 with the same frozen inputs and CLI settings.

All nine primary successes passed the 21 external checks, the 55-test existing controller suite plus newly added tests, and source/Git/report boundaries. Six passed on their first submission. Four initial submissions failed the same `legacy-id-binding` check despite passing internal reviews: baseline slots 0 and 4, and added-recovery slots 2 and 6. Three corrected successfully; slot 2 was interrupted by usage exhaustion. The two timeouts occurred during integration before external submission. Outcomes outside the exercised checks remain unknown.

### Every scheduled workflow

Seconds are per-workflow monotonic intervals. Initial submission excludes its external acceptance; verified completion includes acceptance. A correction has a separate 360-second budget after the initial failure, so a verified total above 600 seconds is not an initial-budget overrun. Missing success durations remain unobserved, not zero.

| Slot | Source | Guidance | Outcome | Initial submission, s | Verified total, s | Correction through verification, s |
|---:|---|---|---|---:|---:|---:|
| 0 | Defective | Baseline | pass after correction | 506.6 | 781.5 | 264.2 |
| 1 | Defective | Added recovery | timeout | — | — | — |
| 2 | Defective | Added recovery | usage interruption | 591.5 | — | — |
| 3 | Defective | Baseline | first-pass success | 484.5 | 495.1 | — |
| 4 | Defective | Baseline | pass after correction | 507.0 | 802.5 | 284.8 |
| 5 | Defective | Added recovery | timeout | — | — | — |
| 6 | Authored control | Added recovery | pass after correction | 590.5 | 929.7 | 328.5 |
| 7 | Authored control | Baseline | first-pass success | 478.6 | 489.2 | — |
| 8 | Authored control | Baseline | first-pass success | 457.0 | 467.7 | — |
| 9 | Authored control | Added recovery | first-pass success | 560.5 | 571.2 | — |
| 10 | Authored control | Added recovery | first-pass success | 574.3 | 585.0 | — |
| 11 | Authored control | Baseline | first-pass success | 497.7 | 508.4 | — |

The two timeout observations ended at 600.0 seconds; the usage-interrupted attempt ended at 652.9 seconds including its attempted correction. These are incomplete observations, not successful latency measurements. Successful correction-to-resubmission intervals were 253.3, 274.0 and 317.9 seconds; including the confirming external checks gives 264.2, 284.8 and 328.5 seconds. Unsuccessful correction is censored; first-pass successes have no applicable correction duration.

## Post-observation control defects

The intended corrected control was not fully clean. The first added-recovery control run found that a Pi identity tagged `id` could contain the recorded path and bypass UUID validation. A separate reproduction confirmed the incorrect prompt. Its first repair rejected that malformed identity but broke valid legacy UUID bindings, triggering the frozen correction cycle.

The final baseline control independently found the same malformed-ID issue and another omitted case: a canonical native path alias was rejected even when it resolved to the recorded session file. Its repair preserved legacy compatibility. The native identity resolver already canonicalizes path references; the alias expectation follows that existing contract. These are observed synthetic controller behaviors, not evidence of live native exploitability or new upstream PR discoveries.

The separate [diagnostic](../fixtures/completion-auto/control-diagnostic.mjs) retains a default 22-check form for the first finding; `--include-path-alias` adds the second, for 23 checks. The original authored control passes 21/23. No primary score, feedback or frozen input changed. Final control sources gave:

| Slot | Guidance | Separate diagnostic | Remaining diagnostic failures |
|---:|---|---:|---|
| 6 | Added recovery | 22/23 | canonical-native-path-alias |
| 7 | Baseline | 21/23 | mistagged-path-id-rejected, canonical-native-path-alias |
| 8 | Baseline | 21/23 | mistagged-path-id-rejected, canonical-native-path-alias |
| 9 | Added recovery | 21/23 | mistagged-path-id-rejected, canonical-native-path-alias |
| 10 | Added recovery | 21/23 | mistagged-path-id-rejected, canonical-native-path-alias |
| 11 | Baseline | 23/23 | None |

The malformed-ID case was found in one of three control runs in each arm; the alias case was repaired only in the final baseline control. This post-observation comparison is not preregistered discovery scoring. It establishes a control-validity gap and provides no added-procedure advantage. Control edits cannot measure false positives, and primary 21/21 passes cannot establish defect-free source. The false-positive rate and exhaustive missed-defect count remain unknown.

## Available usage and audit

| Guidance | Observed input tokens | Cached input subset | Observed output tokens | Tool events | Completeness |
|---|---:|---:|---:|---:|---|
| Baseline | 9,493,326 | 8,500,992 | 93,045 | 256 | Completed context counters |
| Added recovery | 9,322,655 | 8,447,872 | 102,171 | 252 | Three incomplete attempts; lower bound |

Usage keeps the latest exposed cumulative counters once per context, including resumed corrections. It does not add initial and resumed cumulative totals together. Cached input is part of input; reasoning output is not added again to output. Incomplete usage is a lower bound. Smoke, availability probing, preparation, diagnostics and final audit are excluded. Monetary cost and pure model latency are unknown; these totals do not establish an efficiency winner.

The final audit checked 341 shared frozen hashes, the original schedule, runner and primary-oracle hashes, all twelve final source/Git boundaries, report handoffs and correction context identity. All passed. Thirty-six distinct initial contexts produced 43 completed stage responses; the longest saved report has 360 words against the 800-word limit. Exposed shell traces contain 464 completed commands with no obvious network/privilege command matches. No trial processes remain. Hashes and shell inspection do not establish exhaustive read isolation or absence of transient writes.

The runner's nine deterministic checks and complete smoke workflow passed before the comparison. The final diagnostic reproduces both control gaps and distinguishes the repairs. The 55/56 existing-test report difference is explained by whether the separate one-test inbox file was included; primary acceptance consistently uses the 55-test controller file plus new tests. Full repository integration remains F6.3.

## Decision and remaining limits

Under this one-PR task and these budgets, added recovery did not improve verified completion. Its control discovery was also made by baseline, and baseline additionally repaired the alias case. The interrupted attempt cannot establish capability failure. The control defects, tiny repeated sample, inherited CLI defaults and synthetic native boundary prevent a general accuracy claim or normal-activation qualification.

This comparison successfully measures automatic handoffs, bounded completion and observed correction time. **F6.1 acceptance remains open** because valid clean-control assessment and full normally selected workflow qualification remain incomplete. All nine capabilities stay in evaluation; no availability or execution flag changes follow. The next step is to address the known control gaps, require legacy compatibility explicitly, and review the recovery procedure's work within the stage budget before considering another separately frozen comparison. Preserve all existing attempts; do not silently rerun or rescore them.

Reports, traces, source copies and context identifiers stay local. This report and its structured companion contain portable engineering outcomes only.
