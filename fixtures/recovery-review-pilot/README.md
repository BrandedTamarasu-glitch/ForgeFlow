# Phase 2 recovery/review pilot

The frozen protocol schedules 32 independent responses: two capabilities, one defective and one clean case each, two arms, four repeats per case/arm. `pilot.js` constructs existing skill-evaluation plans; it never invokes models. `inputs.json` contains public code/tasks; `answer-key.json` is scoring-only. Procedure copies are frozen experimental treatments from `f12974e`, not alternate canonical sources.

Only prepared prompt strings go to trial contexts. Each trial begins without conversation history and may read its supplied prompt file once, then use no other tools. Both arms inherit the session configuration without overrides. Exact provider identity and sampling settings are unavailable. Access restrictions are instructions, not operating-system isolation. The protocol was frozen before observations; do not rewrite it after seeing outcomes.

`node scripts/forgeflow/test-recovery-review-pilot.js` verifies the pinned plans, counterbalancing, public-code behavior and simulated reload outcomes. A stale cleanup list deletes the published generation; protected deletion retains it. Reload produces an explicit recovery-required status or ready status with preserved items. These statuses are returned objects, not observations of a graphical application. Review cases combine a lost-update defect with permitted partial hint writes, or conditional retries with coherent snapshot publication.

`score.js` accepts actual response text plus post-review evidence adjudications and uses the installed review scorer. Target names alone do not establish a match. Completion additionally requires the exact reload prediction. Invalid responses are retained as failed with null metrics. Report severity and reload prediction details beside existing evaluation completion/missed/false metrics. Regression tests use synthetic responses, never substitute them for actual trials.

The fixture is MIT-licensed synthetic material adapted from repository examples; provenance is in the protocol. Models inspect supplied code and predict supplied schedules, without independent discovery, repair or backend execution. Executed oracle checks remain simulated evidence. Small explicit cases can produce ceiling effects. Actual transcripts remain local; any published result must distinguish observations, unknown token/cost/latency values and activation limits.

See [actual pilot results and limits](../../docs/recovery-review-pilot-results.md). All 32 responses completed; equal scores did not establish benefit.
