# Actual-PR completion pilot

Updated 2026-09-24. **All twelve workflows are accounted for: one verified completion within budget and eleven timeouts. This execution-limited run is inconclusive about incremental capability.** This is a separate follow-up to the [eight-study assessment](capability-evidence.md). Those 178 historical trial slots are not pooled with this pilot's twelve multi-stage workflows.

## Case and method

The known repair case is [Baa-ton PR #6](https://github.com/zachristmas/baa-ton/pull/6), submitted head `2bbb198b7a5852cd64fc243a1392cda56f517640`, base and merge base `51c9d599bd20bddfbcba6f4d5d86cae54f86d329`. A native session UUID was compared directly with a stored session-file path, suppressing pending completion delivery. This evaluates repair of a known defect, not new discovery or current upstream behavior.

The [frozen protocol](../fixtures/completion-pilot/protocol.json) uses defective source and an authored corrected control, normal guidance and added persistence-recovery guidance, and three repetitions of each combination. Each workflow uses three fresh sequential contexts with handoffs, followed by external acceptance. At most two workflows run concurrently. One correction cycle reuses the same contexts. Generic worker dispatch uses maintained workflow instructions; this is not native client discovery or full consult-to-ship coverage.

Both arms receive the same source variant, task, base instructions, tools, scope, handoff transport and budgets. Initial work has 600 seconds, correction has 360 seconds, and external acceptance has 30 seconds. The monotonic clock includes preparation, approvals, execution, report transfer, coordination and verification. Final reports have an 800-word limit. Tool counts are advisory and remain unknown; token usage, backend sampling and cost are unavailable. The session model is inherited without an override.

Preflight independently qualified the submitted head at 19/21 checks, corrected control at 21/21 plus 55 existing tests, and incomplete repair at 20/21. The frozen external checks exercise the actual controller with synthetic native responses and session files. They cover identity, readiness, durable claims, concurrency and no replay. They do not qualify live native delivery, operating-system crashes or production durability. The [preparation record](../fixtures/completion-pilot/README.md) describes the freeze and rejected earlier candidate.

Wording-only routing initially selected nothing. A source-grounded assessment selected persistence recovery without forced includes. This is an assessed evaluation treatment, not evidence that automatic routing succeeded. Enhanced initial instructions add 746 words; later-stage instructions are identical and receive concrete prior reports.

## Results

| Input | Arm | Verified completion | Timeouts |
| --- | --- | ---: | ---: |
| defective | Normal | 0/3 | 3 |
| defective | Added recovery | 0/3 | 3 |
| corrected-control | Normal | 1/3 | 2 |
| corrected-control | Added recovery | 0/3 | 3 |

All twelve scheduled workflows launched. Of 36 maximum fresh contexts, 28 launched and 24 returned a saved final report; correction reused existing contexts. Eight later-stage contexts were never launched after deadlines. Four contexts had no final report. A context returning a report does not imply its workflow completed. No attempt was replaced. The [structured results](completion-pilot-results.json) preserve every slot, its clocks, final word counts and missing measurements.

The sole qualifying run used normal guidance on the corrected control: first submission at 550.14 seconds, verified completion at 560.71 seconds. It passed all 21 external checks, existing and added tests, write-boundary checks and final-word limits. All six defective workflows timed out without verified completion. All six corrected controls preserved application source unchanged.

| Queue slot | Input / arm | Terminal observation (seconds) | Outcome detail |
| --- | --- | ---: | --- |
| 00 | defective / normal | 983.88 | 20/21 initial; correction timed out |
| 01 | defective / added recovery | 1042.16 | 20/21 late initial; correction timed out |
| 02 | defective / added recovery | 611.81 | Final integration interrupted |
| 03 | defective / normal | 628.59 | Validation complete; integration unstarted |
| 04 | defective / normal | 630.20 | First stage interrupted |
| 05 | defective / added recovery | 623.94 | First stage complete; downstream unstarted |
| 06 | corrected-control / added recovery | 627.17 | Final report retained; no external submission before timeout |
| 07 | corrected-control / normal | 560.71 | 21/21 external; verified completion |
| 08 | corrected-control / normal | 769.42 | Late validation report; integration unstarted |
| 09 | corrected-control / added recovery | 769.18 | Validation interrupted |
| 10 | corrected-control / added recovery | 639.92 | Final integration interrupted |
| 11 | corrected-control / normal | 639.69 | Validation complete; integration unstarted |

These are actual terminal observation times, including late deadline detection, not allowed budget extensions. Two correction attempts are censored, nine correction durations are unobserved, and the sole first-pass success is not applicable; all correction-duration values remain null.

Both defective attempts that reached initial external acceptance passed 20/21 checks. Both repaired native UUID delivery but broke direct legacy-ID binding. Their existing and newly added tests passed despite that regression. Both entered correction, and neither obtained external verified completion within its correction budget. Correction durations are censored and null, not successful times.

Passing tests reported during an unfinished workflow do not substitute for its final external acceptance. Source edits on defective inputs likewise do not establish successful repairs. The corrected control is an authored reference, not an exhaustive clean-code claim.

## Execution limitations

This run does not support a clean inference about comparative accuracy, capability or procedure latency:

- Sandbox Unix-socket restrictions, opaque test-runner failures and overly long temporary socket paths consumed time. Host reruns could pass after sandbox failures. Preflight qualified helpers and acceptance but did not smoke-test the complete staged model workflow and its permission behavior.
- Manual report transfer and handoffs consumed the same clock as task work. Monitoring sometimes exceeded the intended 30-second interval; context compaction also delayed deadline handling. Actual observation times are retained without backdating. One initial submission was checked after its deadline and remains ineligible; later unfinished attempts were stopped. This inconsistent deadline handling is a protocol execution limitation.
- Blanket no-servers wording conflicted with the mandatory suite's disposable socket fixtures. Identical clarification was sent to affected paired runs. One pair also received clarification that an already-listed module could be read; the final pair received matching permission to use a shorter alias to its existing evidence directory. These were scope clarifications, but they show the packets were not operationally self-sufficient.
- Scope isolation was instructional with source hashes and Git checks, not an operating-system read sandbox. Final-state auditing cannot prove absence of transient edits or unauthorized reads. Coordinator report receipt times are not exact backend completion times.
- One underlying PR and three repetitions cannot support general superiority. Known repair, authored control and prior discovery studies answer different questions. Earlier complementary findings and visual gains remain valid within their documented limits.

## Artifact audit

All 843 immutable shared input hashes still match the frozen manifest. All twelve final workspaces retain their baseline Git HEAD with no staged changes; source changes are confined to the permitted controller file and new regression tests. Original existing tests are unchanged. Saved final reports remain within 800 words. These checks establish final artifact boundaries, not a complete execution or read audit. No preview server was started.

## Next action

Keep F6.1 open and all nine procedures in evaluation. Before another model comparison, fix the execution setup: use a short temporary path, make disposable test-service permissions explicit, transfer reports directly to artifacts, and enforce deadlines independently of conversational report handling. Smoke-test one complete workflow with these conditions before freezing another schedule. Preserve this run; do not replace its failures or enlarge its budget after observation. Any further model trials require a separately defined and authorized run.
