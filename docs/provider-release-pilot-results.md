# Provider and release task pilot

Date: 2026-09-23. **Incomplete: 34 completed trials, one interrupted attempt and one unstarted slot. No measured accuracy gain is established.** The [protocol](../fixtures/provider-release-pilot/protocol.json) and task/oracle/treatment hashes were frozen after independent control review and before the first model response. Previous Phase 1, Phase 2 and revised recovery results remain unchanged.

## Method and control qualification

The pilot has 36 slots: provider cache, web release gate and installed command startup gate; defective and control versions; baseline, short-checklist and full-procedure arms; two repetitions. There are six underlying versions. Arm positions are balanced over the corpus, not within each two-repeat case. Trials inspect and repair actual source in disposable workspaces. They receive the same contract and task budget, with only the treatment text differing. Hidden acceptance receives a family and submitted module path, never an arm label. Local test additions are permitted; task contracts are fixed.

Three independent control reviews found gaps before freeze. Provider coverage now observes stale success/error while the newest refresh is pending, followed by newest-request failure. Web coverage now distinguishes response-body decoding failure from failure before headers and preserves known failures. Native review found a real relative-path bug in the candidate control; resolving input paths against the caller's directory fixed it. The oracle now checks nested relative paths, required readiness output, child working directory, binary profile bytes and snapshot/restoration errors. An initially ineffective relative-path probe was corrected before freeze. Revised controls were rechecked independently: 9 provider, 15 web and 16 installed-command checks pass. The defective versions fail 7, 12 and 11 checks respectively. Ten deliberate mutations verify specific detection paths. This is bounded control qualification, not proof that every possible defect is covered.

The session's subagent thread limit prevented new fresh subagent contexts. Before any trials, the runner was changed to a new `codex exec --ephemeral` process per slot without resuming a prior thread. `gpt-6-astra` explicitly matches the configured model recorded for the current session. CLI defaults are used without a reasoning override; hidden settings are not asserted equivalent to the earlier pilots. Every arm uses the same runner and permissions. Tool/word budgets remain instructional: 16 calls and a 200-word final response. The supervisor enforces a four-minute process limit and a separate 30-second oracle limit. Missing, failed or timed-out attempts remain in the denominator with no replacement slots. Workspaces and file boundaries are instruction-controlled, not a complete filesystem isolation guarantee.

The primary outcome is complete acceptance of every frozen check, with initially passing-check regressions reported separately. Clean-source edits are counts, not false-positive findings. Any subsequently discovered control defect must be reported separately and invalidate the affected control inference; primary inputs and results cannot be silently revised.

## Outcomes

The CLI reported an account usage limit during slot 35 (native checklist control), after tool work but before a completed response. The supervisor stopped, preserving that unsuccessful attempt. Slot 36 (native full-procedure control) has not started. Neither slot is counted as an acceptance pass, and the interrupted slot must not be replaced. F3.4 remains unchecked until the remaining authorized slot can run and reporting is finalized.

Every denominator below is the two scheduled repetitions. Failed and missing attempts remain included.

| Task | Arm | Complete defective repairs | Complete controls | Failed / unstarted attempts |
| --- | --- | --- | --- | --- |
| Provider | Baseline | 2/2 | 2/2 | 0 / 0 |
| Provider | Checklist | 2/2 | 2/2 | 0 / 0 |
| Provider | Full | 2/2 | 2/2 | 0 / 0 |
| Web | Baseline | 2/2 | 2/2 | 0 / 0 |
| Web | Checklist | 0/2 | 2/2 | 0 / 0 |
| Web | Full | 2/2 | 2/2 | 0 / 0 |
| Installed command | Baseline | 2/2 | 2/2 | 0 / 0 |
| Installed command | Checklist | 2/2 | 1/2 | 1 / 0 |
| Installed command | Full | 2/2 | 1/2 | 0 / 1 |

All 18 defective-repair responses completed. Baseline and full procedure each repaired 6/6; checklist repaired 4/6 under the frozen oracle. Its two web submissions each passed 14/15 checks, failing only `bodyless-cache`. No initially passing check regressed in completed trials. Of 16 completed control responses, all passed every check. One native checklist control added `killSignal: 'SIGKILL'` to the child-process timeout; this source edit alone is not a false-positive finding. The interrupted control source was unchanged. All 35 attempted workspaces passed the recorded fixed-file/addition audit, and all had distinct thread IDs. The largest observed tool-event count was seven; completed final responses were at most 186 whitespace-delimited words. These event and file checks do not constitute a complete filesystem-access audit.

### Post-freeze contract ambiguity

The bodyless 304 scenario supplies `text/plain` while the manifest expects `text/javascript`. The written contract calls MIME mismatch a failure and a 304 without cached body unverified, without defining precedence for both on the same resource. Its separate rule about preserving failure on another resource does not resolve this case. The control skips MIME checks for 304, while both checklist repairs preserve the present MIME mismatch as a failure. An independent recheck confirmed the ambiguity. The two frozen failures therefore do not establish checklist inferiority.

A separate [diagnostic](../fixtures/provider-release-pilot/diagnostic-304.js) changes only that response header to match the manifest. All 12 web submissions pass all 15 diagnostic checks. This is post-freeze sensitivity evidence, not a replacement primary score or a revised efficacy trial. Frozen contracts, controls, treatments and oracle hashes remain unchanged. The ambiguity remains an unresolved validity limitation.

### Available execution measurements

The 34 completed CLI turns report aggregate usage of 3,180,021 input tokens (including 2,549,248 cached input tokens), 83,694 output tokens and 7,144 reasoning-output tokens. These are the runner's reported fields; repeated context is included, and reasoning tokens are not added to output totals here. Usage for the interrupted attempt is unavailable. Review and coordination overhead is excluded.

Mean elapsed process time was 88.3 seconds for 12 baseline attempts, 96.4 seconds for 12 checklist attempts (including the interruption), and 90.1 seconds for 11 full-procedure attempts. These incomplete, unequal samples include startup, tools and model waits, so they are not pure model latency or an efficiency comparison. Exact resolved backend, monetary cost and correction time remain unavailable. The frozen scorer's null measurement placeholders are supplemented by these separate CLI observations; the scorer was not changed after freeze.

No broader retest is triggered: full procedure ties baseline on all defective tasks, the checklist difference is contract-sensitive, execution is incomplete and one attempt failed operationally. Earlier pilot results are preserved. No activation qualification follows from these observations.

## Scope of evidence

Provider checks use controlled promises, web gates use real local HTTP with an interaction callback, and installed startup checks use actual Node child processes with disposable state. The pilot does not observe a real public deployment, production package, graphical recovery interface or assistive technology. Earlier [web browser checks](../fixtures/web-release/README.md) and [Linux ELF lifecycle checks](../fixtures/native-release/README.md) remain distinct engineering observations. Windows and macOS remain unverified. No model-benefit or normal automatic activation claim follows from successful fixtures alone.

The exploratory retest trigger requires at least two additional complete defective repairs out of six over baseline, all six treatment control trials passing, no initially passing check regressions and no unresolved control-validity issue. Operational failures and fixed-file boundary issues block automatic triggering. A valid improvement triggers retesting all four previously trialed capabilities, including the earlier Phase 1 pair; it does not establish activation qualification.

Validation at this checkpoint: `npm run test:provider-release-pilot` passes all control, seeded-failure, ten mutation, preparation/balance and scoring checks. Diagnostic syntax and documentation links pass. The preparation test only validates fixture behavior; its unobserved model records are separate from the actual outcomes above.
