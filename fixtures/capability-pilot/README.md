# Phase 1 evidence-interpretation pilot

This small pilot compares the change-propagation and visual-acceptance procedures on supplied synthetic evidence. Each capability has a defect case and a clean/intentional control. Four repetitions of each case in each arm yield 32 trials. Enabled/disabled order is counterbalanced within each case. Neither arm performs independent discovery, repairs or browser work.

`inputs.json` holds task prompts. `answer-key.json` holds the withheld expected findings and scoring criteria. `protocol.json` freezes their hashes, configuration, budget and procedure revisions. `procedures/` contains frozen experimental treatments, not maintained replacements for the canonical procedures. These authored synthetic materials are under the repository MIT license and contain no copied project or personal data.

Run `node fixtures/capability-pilot/pilot.js` to prepare schedules and prompts using the existing task evaluator. This command makes no model calls or writes. Run `node scripts/forgeflow/test-capability-pilot.js` for deterministic scheduling and scoring checks. Hash mismatches stop preparation; a changed treatment or corpus requires a new protocol, not relabeling old results.

For actual trials, use a fresh context for each scheduled trial with the same inherited session model/settings and no overrides. The only permitted tool action loads the supplied prompt file; no further tools, other files, repository edits or peer messages are permitted. The enabled arm gets the frozen procedure plus the task; the disabled arm gets the task alone. Neither gets the answer key, scoring rubric, other outputs or conversation history. This provides instruction-level input separation, not OS-enforced isolation or proof against prior public-data contamination.

Keep raw responses and per-trial records local. Score unique expected target IDs, false/duplicate findings and missed targets with `scoreResponse`; separately review the reasons and any claimed verification against the supplied evidence before confirming completion. Invalid/unscored responses retain null outcomes. Feed the complete frozen manifest and records to `summarizeSkillTrials`; omitted attempts remain unobserved. Do not discard failures.

The host does not expose an exact backend model identifier or sampling parameters for inherited trials. Token counts, cost, correction time and model latency stay null when unavailable. Prompt UTF-8 bytes and response word counts are separate descriptive overhead measures, not token estimates. Small samples, explicit task hints and supplied observations can produce a ceiling effect. Equal results do not demonstrate benefit, equivalence or readiness for normal automatic activation. Follow-up qualification needs less guided discovery/repair/browser tasks and more complete execution metadata.

See the [observed results and limitations](../../docs/capability-pilot-results.md). Both procedures remain in evaluation after this pilot.
