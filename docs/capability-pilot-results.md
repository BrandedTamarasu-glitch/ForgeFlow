# Phase 1 pilot results

Date: 2026-09-22. **Both arms completed all supplied-evidence cases correctly. No measured advantage was observed from adding either procedure. Both capabilities remain in the evaluation cohort.**

This was an actual 32-response model pilot, distinct from the deterministic helper and Chromium fixture checks. It tested interpretation of synthetic branding and layout snapshots. It did not test independent consumer discovery, repository repair, screenshot inspection or browser use.

## Protocol

The [frozen protocol](../fixtures/capability-pilot/protocol.json), [inputs](../fixtures/capability-pilot/inputs.json), separate [answer key](../fixtures/capability-pilot/answer-key.json) and procedure snapshots were prepared before the first response. Each capability had one defect case and one clean/intentional control, with four repetitions per arm per case. Each arm occupied each order position twice. Trials ran sequentially in fresh contexts without conversation history; no response was reused as a subsequent trial's context.

Both arms inherited the same session model and settings without overrides. The exact provider model identifier and sampling parameters were not exposed, which limits reproducibility. The enabled arm received the frozen procedure plus the task; the disabled arm received the same task alone. The only permitted tool action loaded the trial prompt file; the task's no-tools rule then applied. No key or rubric was passed to the trial contexts. File-access restrictions were instructional, not OS-enforced isolation, and tool adherence was not independently audited.

The response budget was an instructed 180 words, not a hard token cap. Scoring used the frozen expected target IDs for missed and false findings, followed by an unblinded review of explanations and verification claims against the supplied evidence. “Completion” below means correct interpretation of that snapshot, not acceptance of an application or deployment. Raw responses and per-trial evidence remain local.

## Observed outcomes

| Capability | Arm | Correct / scheduled | Missed defects | False findings | Failed / unobserved |
|---|---|---|---|---|---|
| Change propagation | Disabled | 8 / 8 | 0 | 0 | 0 / 0 |
| Change propagation | Enabled | 8 / 8 | 0 | 0 | 0 / 0 |
| Visual acceptance | Disabled | 8 / 8 | 0 | 0 | 0 / 0 |
| Visual acceptance | Enabled | 8 / 8 | 0 | 0 | 0 / 0 |

Both branding arms found the stale favicon, guide and screenshot provenance, and left deliberate historical branding alone. Both layout arms found the oversized card and accepted the intentional width ratio and differing stacked heights. Missing screenshots, external checkouts and accessibility observations were treated as limitations. All 32 scheduled responses were retained and scored; none were replaced or omitted.

## Observed overhead and unknowns

| Capability | Mean task prompt bytes, disabled | Mean task + procedure bytes, enabled | Added bytes | Mean response whitespace units, disabled / enabled |
|---|---|---|---|---|
| Change propagation | 1,186.5 | 5,994.5 | 4,808 | 43.75 / 59.75 |
| Visual acceptance | 1,228.5 | 5,569.5 | 4,341 | 42.25 / 56.375 |

Prompt counts are UTF-8 bytes of the prepared input, excluding common host instructions and transport. Response counts split the JSON response on whitespace; the largest was 79 units. These are descriptive size counts, not token or billing estimates. Tokens, cost, latency and human correction time remain **unobserved/null**.

## Interpretation and next qualification

The small, explicit cases produced a ceiling effect: the baseline already answered every case correctly. Equal results do not establish equivalence, statistical superiority or benefit on less guided work. Supplying the observations also bypassed the discovery and browser tasks that these procedures are meant to improve. The added prompt size is observed overhead; its effect on latency and cost was not measured.

Do not promote either capability to normal automatic execution on this evidence. Later activation qualification needs fresh cases requiring discovery, repair and image/browser inspection, a less guided clean control, and a runner exposing exact model/configuration and resource measurements. Freeze those cases before observing outcomes. F1.3's bounded pilot is complete; broader benefit qualification remains in Phase 6. The next implementation item is F2.1, persistence recovery.

Validation: `node scripts/forgeflow/test-capability-pilot.js`, `node scripts/forgeflow/test-task-evaluation.js` and `node scripts/forgeflow/test-skill-evaluation.js` passed. These regression checks use synthetic responses and do not themselves recreate the actual model observations above.
