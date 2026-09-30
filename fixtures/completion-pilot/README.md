# Actual-PR repair/completion pilot

Updated 2026-09-24. **The authorized twelve-workflow run is complete.** See [results and execution limitations](../../docs/completion-pilot-results.md). All twelve actual-PR workflows are accounted for: 1 verified completion within budget and 11 timeouts. Execution and permission friction prevent a clean capability comparison. Both defective initial submissions that reached external acceptance broke legacy-ID compatibility; successful correction time remains unobserved. This extends [F6.1 evidence consolidation](../../docs/capability-evidence.md). Normal capability activation remains gated.

## Actual PR provenance

The case is [Baa-ton PR #6: retry durable completion notifications](https://github.com/zachristmas/baa-ton/pull/6). GitHub metadata and local objects agree on head `2bbb198b7a5852cd64fc243a1392cda56f517640` and base `51c9d599bd20bddfbcba6f4d5d86cae54f86d329`; their merge base is that base. The earlier WarmLedger commit-only candidate was withdrawn before any trial and preserved locally. Its ten-check oracle and 158 passing tests do not qualify this PR.

The PR adds scheduler retries for pending durable completion receipts. A known defect compares a native session UUID directly with the stored canonical session path, rejecting the correct owner. The proposed [task](task.md) repairs delivery while preserving ownership vetoes, durable claims and no-replay behavior. This is known-defect repair on submitted source, not a claim of newly discovered defects or current upstream breakage.

## Frozen comparison

[Protocol](protocol.json) specified twelve workflows: defective and authored corrected inputs, normal and selected-procedure arms, three repetitions per combination with counterbalanced order. Each uses independent implementation, validation and integration contexts, sequential handoffs and external acceptance. At most one correction cycle reuses the same contexts. Both arms receive identical base guidance, tools, source and time limits.

The wording-only selector initially skipped all capabilities. A source-grounded assessment of durable receipt publication selects persistence recovery without forced includes. This is a routing limitation and an explicitly assessed evaluation treatment; it does not demonstrate automatic selection success. The enhanced arm loads that selected procedure under the maintained evaluation exception. The normal arm honors its non-executable evaluation status.

## Preflight status and measurement

The independent reusable-method review qualifies the revised protocol and timing helper. Tool counts are advisory: audited events may be counted, otherwise counts remain null. They are excluded from primary eligibility. External acceptance, existing tests, source boundaries, observed time and final-word limits remain mandatory.

Monotonic observations distinguish first submission, passing completion and correction. First-pass success gives `not_applicable` correction; missing observations give `unobserved`; failed or interrupted correction is `censored`. Durations include orchestration and validation waits. Timeout diagnostics now flag unfinished stages that exceeded their budgets. The recorder requires sequential coordinator writes within one Linux boot; it is not a concurrent or crash-durable logger.

```sh
node scripts/forgeflow/test-completion-pilot.js
```

The independent PR acceptance review qualifies the bounded case:

| Source | Acceptance | Existing controller suite |
| --- | --- | --- |
| Submitted PR head | 19/21; correct UUID delivery and busy-to-ready recovery fail | Not rerun during this preflight |
| Authored corrected control | 21/21 | 55/55 pass |
| Incomplete fix omitting UUID equality | 20/21; foreign-session rejection fails | Not required for mutation rejection |

The [external oracle](acceptance.mjs) imports the actual controller and uses synthetic native responses and session files. It checks identity vetoes, readiness, stale incarnation, durable sending before prompt I/O, concurrent/repeated ticks, and no replay of sending/uncertain/delivered receipts. The control uses the header of the exact bound regular session file; it does not infer identity from its filename. That is a local same-user identity check, not protection against malicious session-file replacement.

With an appropriate snapshot, run:

```sh
node fixtures/completion-pilot/acceptance.mjs /path/to/pr-snapshot
```

From the snapshot, run `node --test packages/controller/test/controller.test.mjs`. The initial sandbox attempt failed before individual test results; approved host execution passed all 55 tests in 10.52 seconds. Both trial arms require equivalent local Unix-socket access. This is the controller suite, not the full application suite. The superseded WarmLedger oracle remains separately named for reproducibility and must not score this PR.

Final preparation and independent recheck are complete: twelve clean Git workspaces with identical starting context, 36 rendered stage packets, six passing workflow helpers and five intended scope files. Same-variant source copies are byte-identical; only the controller differs between defective and corrected variants. The enhanced implementation packet adds 746 words of recovery guidance. Later-stage prompts are identical; concrete results pass through verbatim reports.

[Freeze summary](freeze-summary.json) records 2,307 file hashes across source variants, runtime, instructions, packets, queue, acceptance, timing and preflight evidence. The local manifest SHA-256 is `5a842a1d87034eaacc39847f08e8191b75dea3c2af09fdba61e9967534369f36`. Immutable queue and prelaunch hashes must be checked before execution; launched outcomes are recorded separately.

The planned maximum was twelve workflows using 36 fresh worker contexts, with at most one correction cycle reusing each trial's contexts. Two workflows may run concurrently, with stages sequential inside each. Initial workflow budget is 600 seconds, correction budget 360 seconds, and external acceptance has 30 seconds. All launched failures and interruptions remain in the denominator. The frozen protocol and freeze-summary status fields preserve the prelaunch state; the results report records authorization and actual execution separately. The completed queue must not be rerun, and the withdrawn WarmLedger queue must never run. Raw source snapshots and review evidence stay local. No general benefit, full consult-to-ship coverage, native deployment or live recovery qualification follows from preparation.
