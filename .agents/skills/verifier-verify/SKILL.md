---
name: verifier-verify
description: Verify high-risk Forgeflow findings with a non-persona evidence-only pass.
---

At workflow entry, run `node <helper-dir>/open-session-dashboard.js --root <project-root> --workflow verifier-verify` when available. Resolve `<helper-dir>` from the checkout's `scripts/forgeflow` first, then `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. The helper starts or reuses agent-chat and reports known workflow phases on each entry; it uses `CODEX_THREAD_ID`, `CLAUDE_SESSION_ID`, or `FORGEFLOW_SESSION_ID` to open the local dashboard once per session. If the host supplies a session id separately, pass `--session <host-session-id>`; never invent a new id per invocation. Headless runs and `FORGEFLOW_DASHBOARD_AUTO_OPEN=off` skip the launch. A missing helper or unavailable browser must not block the workflow. Report actual phase transitions, significant progress, waiting, and the final result with `node <runtime-root>/services/agent-chat/client.js activity <state> "<short label>"` (`<runtime-root>` is the checkout or installed `forgeflow` directory). Use `complete` only when work and required checks have finished; report `failed` for failures, and never invent progress to keep Ember moving.


Use this skill when a review finding is high risk or high impact and needs confirmation before becoming a blocker.

High-risk classes:
- security
- auth, session, permissions, tenant isolation
- migration, schema, data loss
- critical correctness
- broad refactor regression
- accessibility blocker

Workflow:
1. Gather only the cited finding, cited files/snippets, reviewer name, and finding class.
2. Spawn `verifier` when available.
3. Ask for exactly one decision: `CONFIRMED`, `REJECTED`, or `BLOCKED`.
4. Require the verifier to cite the evidence it used.
5. Feed the verifier result to Architect before final synthesis.

Rules:
- Do not broaden scope beyond the finding.
- Do not let persona authority count as evidence.
- If cited evidence is absent, the correct result is `BLOCKED`, not `CONFIRMED`.
- If the finding only restates a general rule, the correct result is `REJECTED`.

Prompt template:

```text
Verify this Forgeflow finding from visible evidence only.

Reviewer:
Finding class:
Claim:
Cited evidence:

Return:
Decision: CONFIRMED | REJECTED | BLOCKED
Evidence:
Reasoning:
Required next action:
```

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
