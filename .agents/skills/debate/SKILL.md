---
name: debate
description: Run the Forgeflow false-positive debate workflow on a code sample and answer key.
---

At workflow entry, run `node <helper-dir>/open-session-dashboard.js --root <project-root> --workflow debate` when available. Resolve `<helper-dir>` from the checkout's `scripts/forgeflow` first, then `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. The helper starts or reuses agent-chat and reports known workflow phases on each entry; it uses `CODEX_THREAD_ID`, `CLAUDE_SESSION_ID`, or `FORGEFLOW_SESSION_ID` to open the local dashboard once per session. If the host supplies a session id separately, pass `--session <host-session-id>`; never invent a new id per invocation. Headless runs and `FORGEFLOW_DASHBOARD_AUTO_OPEN=off` skip the launch. A missing helper or unavailable browser must not block the workflow. Report actual phase transitions, significant progress, waiting, and the final result with `node <runtime-root>/services/agent-chat/client.js activity <state> "<short label>"` (`<runtime-root>` is the checkout or installed `forgeflow` directory). Use `complete` only when work and required checks have finished; report `failed` for failures, and never invent progress to keep Ember moving.


Use this skill when the user wants to stress-test review quality against a known answer key.

Expected input shape:
- `CODE:` block
- `ANSWER KEY:` block

Workflow:
1. Parse the code and answer key.
2. Never expose the answer key to the initial debating agents.
3. Run Round 1 openings in parallel with `smith_reviewer`, `warden_reviewer`, `lumen_reviewer`, and `atlas_reviewer`.
4. In Round 1, require every debating agent to obey the mandatory pre-flights before raising a finding:
   - transaction/idempotency
   - loop or N+1 complexity
   - parameterization or injection
   - return-contract accuracy when relevant
   - validation/normalization/deduplication
5. Send Round 1 outputs to `arbiter_debate_judge` for an interim verdict.
6. Run Round 2 rebuttals where each agent names the finding they most disagree with and explains why it is incorrect or overstated.
7. Run Round 3 with one falsifiable claim from each debating agent.
8. Send the full transcript to `arbiter_debate_judge` for the final verdict.
9. Only then send the answer key and full transcript to `compass_debate_validator`.
10. Return the final verdict, false positives, misses, and calibration notes.

Rules:
- Treat the answer key as private validation data.
- The value of this workflow is calibration, not theatrics.
- Focus on grounded false-positive analysis.
- If both `CODE:` and `ANSWER KEY:` are not present, stop and ask for them.
