# Real-project review comparison

Date: 2026-09-23. **Complete: 12/12 reviews. Each arm found three distinct confirmed defects, with two shared and one unique to each arm. The enhanced-only finding provides case-specific added value; no net or replicated defect-yield advantage was observed.**

## Cases and method

| Case | Frozen revision | Comparison | Added procedures |
| --- | --- | --- | --- |
| [Baa-ton PR 6](https://github.com/zachristmas/baa-ton/pull/6), durable completion notifications | `2bbb198b7a5852cd64fc243a1392cda56f517640` | `51c9d599bd20bddfbcba6f4d5d86cae54f86d329` | Persistence recovery |
| [baa-ton-forge PR 19](https://github.com/BrandedTamarasu-glitch/baa-ton-forge/pull/19), manifest compatibility | `d4f2b724bb664f994a68fa1b3767fc5a43b14dad` | `b97b2a0cc2c97c646ddbca36c7cc8eca7d8d62cb` | Change propagation |
| [WarmLedger update](https://github.com/BrandedTamarasu-glitch/WarmLedger/commit/c41b4f1d2c6c13740a25bda3848969ca7b525382), check-in, schedules, targets and scenarios | `c41b4f1d2c6c13740a25bda3848969ca7b525382` | Parent `1c7f25f3658726d8254f5f8b91db0d1150aed953` | Persistence recovery, change propagation, visual acceptance |

These are three selected real changes, not a random sample of all projects. The two orchestration changes share an ecosystem. PR heads are the submitted snapshots observed during selection, not asserted original pre-review versions. WarmLedger is a commit comparison, not a PR. Both PR merge bases were verified.

Twelve reviews were scheduled and completed: baseline and enhanced, two repetitions per case. Each uses the same existing ForgeFlow security/systems reviewer instructions, task and tools; enhanced receives the listed canonical procedures. This is a single reviewer pass, not the complete multi-agent workflow. WarmLedger's combined treatment cannot attribute a difference to one of its three procedures. Review-calibration rules govern post-review adjudication; review calibration is not separately tested as a treatment. Reviewer guidance and procedure text come from ForgeFlow revision `57600d6` and were frozen before responses. The local frozen-protocol SHA256 is `348b842d0e9dd7fb4351b24e8699bcfaadbfe295581294c83a1b9e5a972344f9`.

Each review starts a fresh `codex exec --ephemeral` process configured with `gpt-6-astra`, without resuming a thread, loading user configuration or overriding reasoning defaults. Exact resolved backend and hidden sampling settings remain unknown. There are two concurrent processes per pair. Queue submission order is baseline/enhanced then enhanced/baseline within each case; actual start/completion order can differ because of concurrent scheduling. Budgets are identical within cases: 48 tool calls and 2,000 final-response words by instruction; supervisor time limits are eight minutes for each PR and twelve minutes for WarmLedger. Failed, incomplete and timed-out slots remain recorded without replacement.

Reviewers receive head/base source snapshots, the filtered diff, existing tests and project documentation. Git history, previous audit reports, live-trial outcome documents, local workflow state, prior review comments and peer responses are withheld. Exclusions are applied identically to both arms. Source files must remain unchanged; reproduction scripts and browser artifacts may be added in designated scratch directories. External network, live credentials and production operations are prohibited. File access boundaries are instructional rather than complete OS isolation; source hashes and added paths are audited. Frozen hashes cover snapshots, common instructions, prompts and schedule.

## Setup observations

On Node 26.9.0, the notification controller suite passes 55 tests, the manifest project passes 102 tests and WarmLedger passes 778 tests. WarmLedger's existing disposable-profile Chromium checks pass. Initial managed-sandbox subprocess failures disappeared when setup checks ran on the host; these are environment observations, not findings about the PRs. Existing checks establish testability and are not a complete correctness oracle. No production installation, public deployment or human accessibility check is performed.

## Adjudication and limits

After collection, reported claims are assessed without arm labels, deduplicated by mechanism and checked against both snapshots. Every claim receives one disposition: confirmed introduced defect, pre-existing issue, unsupported claim or unresolved. Confirmation requires a reproducible violated behavior grounded in the source/contract. Reported severity is evaluated against the frozen impact rubric. Missing execution evidence is not automatically false, and lack of a reported issue does not prove the code is clean.

The primary observations are independently verified introduced defects per review, distinct defects found by each arm, unsupported findings and unresolved claims. There is no exhaustive answer key, so total recall, missed unknown defects and overall accuracy cannot be computed. An enhanced-only verified finding supports case-specific additional discovery; occurrence in both enhanced reviews and neither baseline is replicated case-specific evidence. Neither establishes broad efficacy or automatic activation. Operational failures, source mutations and scope violations must be reported separately.

The selected PRs have no formal GitHub review records. A claim that a previous review missed an issue requires dated prior findings and is separate from the controlled baseline comparison. If valid improvement is demonstrated, the standing follow-up covers all four earlier trialed capabilities; these twelve slots do not include those additional retests. Previous pilot results remain unchanged.

## Results

All twelve fresh contexts returned valid reports. No failed/missing slots, original-source mutations, added-file boundary failures, or recorded tool/word budget overruns occurred. Completed tool-event counts ranged from 8 to 24; final JSON reports were at most 567 whitespace-delimited words. The event audit found command executions and messages, with no web-search or connector calls; it is not a complete filesystem/network-access audit. No evaluation-owned processes remained in the process check after verification.

Seventeen reported claims were grouped into six mechanisms before revealing their arm labels. Four mechanisms are confirmed introduced defects; two remain unresolved policy/contract questions. Ten claim occurrences were confirmed and seven were unresolved. None was adjudicated demonstrably unsupported or pre-existing. Unresolved claims must not be treated as correct findings or as a zero false-alarm rate.

### Confirmed findings

Counts below are reviews reporting the same verified defect, out of two per arm. Repeated reports are not additional distinct bugs.

| Verified defect | Baseline | Enhanced | Demonstrated impact |
| --- | --- | --- | --- |
| Notification session identity compares UUID with stored canonical path | 2/2 | 2/2 | A valid owning session is rejected on repeated ticks; reporting the same session as its canonical path permits delivery. Medium severity. |
| Recovery reselects a path inconsistent with a saved legacy snapshot | 2/2 | 2/2 | Unchanged saved evidence recovers on the base revision but fails on head. Both absent-manifest and directory-alias variants reproduce; counted as one mechanism. Medium severity. |
| Array-valued contribution-target months pass backup validation | 1/2 | 0/2 | Restore persists malformed months; after reload, views fail to initialize while the store says ready and the recovery panel stays hidden. Medium severity. |
| Snapshot-only storage events discard unchanged scenario drafts | 0/2 | 1/2 | A second tab's failed save erases temporary inputs in the first tab despite byte-identical primary ledger data. Low severity. |

Both arms therefore have three distinct confirmed defects and five confirmed finding occurrences across six reviews. Neither exclusive ledger finding repeated in both runs of its arm. The enhanced review provides an actual example of additional discovery, while the baseline-only finding prevents interpreting the totals as overall superiority. Different review attention and run-to-run variation remain plausible explanations. The three-procedure WarmLedger treatment does not identify which procedure caused its extra finding.

### Independent verification

- **Notification identity:** executed the pinned controller with a disposable manifest and synthetic native metadata. The existing identity resolver verifies the UUID/path relationship. Three ticks with UUID metadata remain pending; the same session represented by its path delivers once. This exercises actual controller code, not a live production controller.
- **Manifest compatibility:** ran the same saved snapshot and unchanged filesystem against both revisions. Base returns `submission-no-effect`; head rejects the saved path. Synthetic native preflight accepts both the absent legacy path and an existing directory alias.
- **Malformed backup:** independently repeated Node validation/import and Chromium restore/reload. Head accepts the array fields and throws `Invalid month`; base rejects the unsupported backup. More decisively, changing only the array-valued months to strings lets the head initialize normally. This isolates the new target-validation/consumer inconsistency.
- **Scenario draft:** repeated the submitted handler reproduction, then strengthened it with two actual disposable Chromium tabs and a trusted browser-generated storage event, without manually invoking the application's event handler. The second tab writes a safety snapshot and fails primary publication. The first tab's draft changes from `123` to `0`, its primary bytes are unchanged, and the status incorrectly reports a ledger change. The first tab is using transient scenario inputs, not concurrently saving the ledger.

These are local source/browser observations on frozen revisions. They do not qualify an installed production controller, public deployment, other browsers/platforms or human accessibility.

### Reproduced behaviors excluded from the primary defect count

| Behavior | Baseline reports | Enhanced reports | Why unresolved |
| --- | --- | --- | --- |
| Proven unsent socket failure becomes permanently `uncertain` | 1/2 | 2/2 | An actual temporary Unix-socket disconnect produces `ENOENT` with `sent=false`, followed by no retry after recovery. However, the new code explicitly sends transport failures to manual review. Whether known-unsent failures must be exempt from that conservative policy needs a requirement decision. |
| Abandoned shards prevent later saves under quota | 2/2 | 2/2 | Actual captured staging bytes plus a synthetic storage quota reproduce repeated head failures, base success and head success without quota. The README already documents passive loading and delayed cleanup consuming space. The availability cost is real, but labeling the documented safety tradeoff a contract violation requires a product decision. Reinstating unsafe read-side deletion is not an acceptable assumed fix. |

Counting these two behaviors as bugs in a sensitivity analysis would add the same two distinct mechanisms to each arm, leaving distinct totals tied at five each. The notification behavior was mentioned more often by enhanced reviews, but it is not a confirmed-defect gain under the frozen adjudication.

### Historical review comparison

Only after blind adjudication was recorded were previous comments and the [committed WarmLedger precommit audit](https://github.com/BrandedTamarasu-glitch/WarmLedger/blob/c41b4f1d2c6c13740a25bda3848969ca7b525382/docs/audits/2026-09-06-precommit.md) inspected. That report covers these features, including scenarios and contribution targets. Neither newly verified ledger issue is listed. Its storage-cleanup tradeoff is explicitly discussed, supporting separate treatment of that concern.

The notification PR comments report bounded native activation evidence on an earlier revision and passing tests for the submitted update; they are not an exhaustive review record. The manifest PR has no comments or formal reviews. Thus the supported historical statement is that the two ledger findings are absent from the saved audit. We cannot prove what every earlier reviewer considered, and historical comparisons cannot isolate changes in model, budget or workflow.

### Execution measurements

| Case | Baseline mean elapsed seconds | Enhanced mean elapsed seconds |
| --- | --- | --- |
| Notifications | 171.4 | 247.2 |
| Manifests | 126.4 | 149.2 |
| WarmLedger | 246.9 | 307.9 |

These are two observations per arm/case and include concurrent scheduling, startup, model waits and tools. They are not pure model latency or a general efficiency estimate. Enhanced task prompts add 5,212, 4,788 and 14,251 UTF-8 bytes respectively; prompt bytes are not token counts.

Across all twelve completed turns, the CLI reports 12,433,363 input tokens, including 11,403,648 cached input tokens, and 65,574 output tokens. Reported reasoning-output tokens are 14,708 and are not added to output totals here. Baseline accounts for 5,966,938 input and 27,388 output tokens; enhanced accounts for 6,466,425 input and 38,186 output tokens. Repeated context is included. Preparation, independent verification and coordination overhead are excluded. Monetary cost and exact backend identity remain unavailable.

## Decision and follow-up

This method found real, independently reproducible defects that the earlier small fixtures did not exercise. The enhanced-only scenario issue is the requested concrete example of added value on a previously reviewed project. The baseline-only malformed-backup issue is equally important counterevidence: this is complementary discovery, not a net accuracy win. No overall accuracy, exhaustive recall, replicated treatment advantage or activation qualification is established.

Use this case-specific signal to prepare the requested broader retest covering **all four earlier capabilities**, not only persistence recovery: change propagation, visual acceptance, persistence recovery and review calibration. Keep the original results and this twelve-review comparison unchanged. The next protocol should separate treatments, use fixed held-out real changes, independently qualify any clean controls, include at least three repetitions under the later controlled-comparison milestone, and freeze adjudication rules for intentional safety tradeoffs. Known ledger defects may be calibration cases but cannot masquerade as held-out discovery tasks. No additional model trials were run in this batch.

The four confirmed defects are present in the pinned application snapshots; current upstream heads were not checked for later remedies. This task evaluated them without changing application source or posting to GitHub. Raw prompts, responses, reproduction scripts and execution artifacts remain local-only. Frozen hashes, aggregate arithmetic, response/file boundaries, documentation links and whitespace were checked at completion.
