# Phase 2 recovery/review pilot results

Date: 2026-09-23. **All 32 actual responses passed the frozen cases. Both arms had equal outcomes; no measured accuracy benefit was established. Persistence recovery and review calibration remain in evaluation.**

## Method and scope

The [protocol](../fixtures/recovery-review-pilot/protocol.json), [inputs](../fixtures/recovery-review-pilot/inputs.json), [separate answer key](../fixtures/recovery-review-pilot/answer-key.json) and procedure snapshots were frozen before the first response. Each capability had one defective and one clean case, with four repeats per case/arm. Each arm occupied each order position twice. All trials ran sequentially in fresh contexts without conversation history or model/settings overrides.

The enabled arm received the frozen procedure and task; the disabled arm received the task alone. Only a supplied prompt-file read was permitted before answering. Access restrictions were instructional, not OS-enforced, and tool adherence was not independently audited. Both arms inherited the session configuration; exact provider model identity and sampling parameters were unavailable. The 250-word response budget was an instruction, not a hard token limit.

These tasks required inspection of supplied JavaScript and explicit contracts. They did not require independent repository discovery, repairs or backend execution. Recovery tasks additionally predicted the result of a supplied cleanup/publication/reload schedule. The review cases combined a lost-update defect with valid partial hint writes, or conditional retry with coherent publication. Reuse of synthetic patterns and explicit assumptions limits generalization.

The coordinating assistant reviewed every claim's mechanism, impact and severity against the key and executable checks after receiving each response. This adjudication was unblinded. The post-review scorer counted those adjudications; target-name matching alone did not establish correctness. All 32 responses were retained, with no replacement, failure, unresolved adjudication or missing result. Response JSON values and per-trial records remain local; no raw transcripts are published.

## Observed model outcomes

| Capability | Arm | Correct / scheduled | Missed defects | False findings | Severity over / under |
|---|---|---|---|---|---|
| Persistence recovery | Disabled | 8 / 8 | 0 | 0 | 0 / 0 |
| Persistence recovery | Enabled | 8 / 8 | 0 | 0 | 0 / 0 |
| Review calibration | Disabled | 8 / 8 | 0 | 0 | 0 / 0 |
| Review calibration | Enabled | 8 / 8 | 0 | 0 | 0 / 0 |

Both recovery arms identified that a stale cleanup list deletes the newly committed generation, and accepted the protected variant under its stated single-threaded guarantees. All 16 recovery predictions matched the executable simulated reload results. Both review arms detected the stale-snapshot lost update, accepted independent partial hint writes, and accepted the explicitly bounded retry and snapshot-publication controls.

## Executed recovery behavior

The independent deterministic check executes the supplied JavaScript and reloads cloned stored bytes. The defective schedule returns `{"status":"recovery-required","items":[]}` because the authoritative blob was deleted. The protected schedule returns `{"status":"ready","items":["old","accepted"]}`. This verifies the fixture's caller-visible recovery status and data, not a graphical UI, real filesystem, power-loss durability or production recovery. No real financial or user records were used.

## Overhead and limitations

| Capability | Mean prompt bytes, disabled | Mean prompt bytes, enabled | Added UTF-8 bytes |
|---|---|---|---|
| Persistence recovery | 1,719.5 | 6,947.5 | 5,228 |
| Review calibration | 1,563 | 6,463 | 4,900 |

Counts cover prepared input only, excluding common host instructions and transport. They are not token or billing estimates. Tokens, cost, model latency and human correction time remain **unobserved/null**. No response-size or resource-use benefit is claimed.

Baseline performance reached the ceiling on these small cases. Equal scores do not establish equivalence or justify activation; the procedures added input size without an observed accuracy gain. Later qualification needs more varied cases requiring discovery and repair, real backend/application observations where relevant, and a runner exposing exact configuration and resource measurements. Keep results from those future cases separate from this frozen pilot.

Validation passed: `test-recovery-review-pilot.js`, `test-review-calibration.js`, `test-task-evaluation.js` and `test-skill-evaluation.js` under `scripts/forgeflow/`. Those regression checks use synthetic scoring records and do not recreate the actual model responses. F2.3's bounded pilot is complete. Next: F3.1, provider compatibility.
