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
3. Run Round 1 openings in parallel with `builder_reviewer`, `guardian_reviewer`, `designer_reviewer`, and `coordinator_reviewer`.
4. In Round 1, require every debating agent to obey the mandatory pre-flights before raising a finding:
   - transaction/idempotency
   - loop or N+1 complexity
   - parameterization or injection
   - return-contract accuracy when relevant
   - validation/normalization/deduplication
5. Send Round 1 outputs to `architect_debate_judge` for an interim verdict.
6. Run Round 2 rebuttals where each agent names the finding they most disagree with and explains why it is incorrect or overstated.
7. Run Round 3 with one falsifiable claim from each debating agent.
8. Send the full transcript to `architect_debate_judge` for the final verdict.
9. Only then send the answer key and full transcript to `product_lead_debate_validator`.
10. Return the final verdict, false positives, misses, and calibration notes.

Rules:
- Treat the answer key as private validation data.
- The value of this workflow is calibration, not theatrics.
- Focus on grounded false-positive analysis.
- If both `CODE:` and `ANSWER KEY:` are not present, stop and ask for them.

## Writing for CLI output

Apply George Orwell's six rules to progress updates, agent reports, and final summaries:

1. Never use a metaphor, simile, or other figure of speech which you are used to seeing in print.
2. Never use a long word where a short one will do.
3. If it is possible to cut a word out, always cut it out.
4. Never use the passive where you can use the active.
5. Never use a foreign phrase, a scientific word, or a jargon word if you can think of an everyday English equivalent.
6. Break any of these rules sooner than say anything outright barbarous.

Lead with the result or next action and its effect on the user's task. Match their technical background and requested detail. Explain an unfamiliar term when needed; retain precise terms for specialist reports. Use a calm, conversational voice and natural contractions. These rules take precedence over persona style and sample prose.

Use connected, short paragraphs with natural sentence variation. Use lists for steps or comparisons and headings when they help navigation. Cut repeated openings, stock transitions, rhetorical questions, forced praise, persona banter, and em dashes in prose. Warmth comes from noticing the user's actual concern and helping them act.

Progress updates should explain a finding, decision, blocker, or what the next check will resolve. Avoid narrating each tool call or repeating the plan. Ask only for information or authorization needed to proceed; explain why it matters. Final replies should stand alone: state what changed, why, what was checked, and any remaining action. Scale the detail to the task. Summarize routine checks; include tool names, versions, and internal counts only when they affect the reader's next decision. Keep validation gaps explicit.

Replace vague benefits with observable behavior. Use a brief example when it clarifies the change; label hypothetical examples. Never invent measurements, personal experiences, user reactions, test results, or approvals to make writing vivid. Keep uncertainty and failures explicit.

Preserve exact commands, code, paths, identifiers, error text, schema keys, verdict labels, and required evidence. Keep required report sections and machine-readable formats; apply style changes only to their prose. JSON-only outputs stay JSON-only. Before sending, check for awkward rhythm, repetition, unsupported claims, and whether the reader can tell what happens next. Clarity and faithful evidence are the goal; detector scores are not a quality gate.
