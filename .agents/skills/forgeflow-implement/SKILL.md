---
name: forgeflow-implement
description: Run the Forgeflow implementation workflow using an implementation brief, with Product Lead handling validation and Architect checking integration.
---

At workflow entry, run `node <helper-dir>/open-session-dashboard.js --root <project-root> --workflow forgeflow-implement` when available. Resolve `<helper-dir>` from the checkout's `scripts/forgeflow` first, then `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. The helper starts or reuses agent-chat and reports known workflow phases on each entry; it uses `CODEX_THREAD_ID`, `CLAUDE_SESSION_ID`, or `FORGEFLOW_SESSION_ID` to open the local dashboard once per session. If the host supplies a session id separately, pass `--session <host-session-id>`; never invent a new id per invocation. Headless runs and `FORGEFLOW_DASHBOARD_AUTO_OPEN=off` skip the launch. A missing helper or unavailable browser must not block the workflow. Report actual phase transitions, significant progress, waiting, and the final result with `node <runtime-root>/services/agent-chat/client.js activity <state> "<short label>"` (`<runtime-root>` is the checkout or installed `forgeflow` directory). Use `complete` only when work and required checks have finished; report `failed` for failures, and never invent progress to keep Ember moving.


Use this skill when the user wants Codex to execute work using the Forgeflow structure.

Resolve every `scripts/forgeflow/...` helper from the current checkout first, then from `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. A missing helper means the Codex runtime installation needs repair; it does not mean the workflow is unsupported in Codex.

Workflow:
1. Load the implementation brief from `.forgeflow/<project-name>/current-brief.md` unless the user points at another brief.
2. Build compact local memory context with `scripts/forgeflow/build-memory-context.js` and first-pass file ownership packets with `scripts/forgeflow/build-scope-manifest.js` when available.
3. Render `scripts/forgeflow/render-lean-decision.js --brief .forgeflow/<project-name>/current-brief.md` when available and carry that advisory guidance into implementation prompts.
4. Run `scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json` and `scripts/forgeflow/advise-context.js --root .forgeflow --record --json` when available. Surface budget warnings, trend deltas, and trim recommendations.
5. If no brief exists, either stop and ask for consultation or run a brief inline consultation if the user explicitly wants that shortcut.
6. Resolve remaining file ownership gaps before edits. No two implementers should own the same file in the same wave.
7. Spawn targeted implementers based on the brief:
   - `builder_implementer`
   - `guardian_implementer`
   - `designer_implementer`
   - `coordinator_implementer`
   - `product_lead_validator`
8. After implementation work finishes, spawn `architect_implementer` to check fit, interfaces, and any minimal integration glue.
9. Report what changed, what was validated, and any remaining risks.

Rules:
- Keep each subagent on a disjoint write scope whenever possible.
- Prefer the smallest defensible patch set.
- Follow lean decision guidance only when it fits the confirmed brief; never use it to remove explicit requirements, security, accessibility, validation, or data-loss safeguards.
- When implementation takes a smaller path, record the known ceiling and upgrade trigger in implementation notes.
- Product Lead focuses on tests and validation artifacts, not product code.
- Coordinator owns coordination and memory, not implementation churn.
- Pass these requirements to every implementer: record bugs discovered outside the assigned scope as `follow-up` note candidates when found, including evidence or reproduction steps and user impact. Coordinator consolidates them into local implementation notes and carries pending issue filing into the handoff. For a temporary workaround, also record its limitations, long-term solution, associated GitHub issue (or pending draft), and agreed timeline or unresolved timeline decision. Preserve file ownership and remote-write authorization.

Suggested prompts:
- `$forgeflow-implement execute the current brief`
- `$forgeflow-implement implement the brief in docs/briefs/login.md`

## Change reflection

Before presenting results, answer the change-reflection questions below from the implementation and validation evidence. Include the answers in the implementation report and save them in the existing implementation notes for review.

1. **Is this the simplest change that solves the problem?** Explain the chosen approach and any smaller alternative considered.
2. **Is the complexity proportional to this project's scale and risk?** Use known users, operations, and maintenance needs; state assumptions when unknown. A 100-user internal app is an example, not a default or a reason to drop required safeguards.
3. **One PR = one concern: did anything unrelated sneak in?** State the concern and connect the changed files to it. Flag unrelated work for a separate change.
4. **In your own words, why does this change work?** Explain how the changes produce the intended outcome. For process-only changes, explain the workflow effect.
5. **How did you verify it, and what did you see?** Give actual commands or manual steps, observed results, and untested limits. For documentation or process changes, describe the instruction or command checks performed and why application tests are inapplicable when that is the case.

6. **Does this resolve the issue long-term, or is it a band-aid?** Explain whether the underlying cause is addressed. A temporary workaround is viable, but the PR must explain its limitations and the long-term solution, link an associated GitHub issue, and state the agreed timeline. If the issue or timeline is missing, report the gap explicitly; never invent an issue link or commitment.
7. **Were bugs found outside this PR's scope?** Capture each discovered bug as a follow-up with evidence or reproduction steps, user impact, and an existing issue link or a local tracking entry awaiting filing. Keep unrelated fixes in separate work; do not discard bugs because they are out of scope.
8. **How does this change affect users, and is training needed?** Describe the affected users and workflow changes. Identify required documentation, onboarding, release notes, or training and their readiness, or explain why none is needed.
9. **Do user-facing errors explain what happened and what to do next?** Check changed failure paths for clear, accurate messages and actionable recovery steps without exposing sensitive details. Cite observed behavior and untested paths, or state why this is not applicable.

Reuse existing issues where possible. Create or update GitHub issues only within current remote-write authorization. Otherwise save an actionable issue draft in local implementation notes and surface the pending filing and timeline decisions in the handoff and PR assessment; a draft does not satisfy the associated GitHub issue requirement. Missing follow-up details remain visible without introducing an automatic approval pause.

Keep answers brief and specific to the current diff. AI collaboration alone is not verification evidence. Label agent-written answers as an agent assessment; never imply a human inspected, understood, or approved the change without their input. These prompts guide reflection and do not add hooks, hard gates, or mandatory confirmation pauses.

## Record explicit review outcomes

After Architect or Product Lead issues an actual final decision, save that decision and its supporting evidence in a project-local report, then record it once with the shared telemetry helper:

```bash
node <runtime-root>/hooks/forgeflow-telemetry.js record-verdict --cwd <project-root> --reviewer <architect-or-product_lead> --verdict "<exact-decision>" --evidence <saved-report-relative-path> --event-id <stable-outcome-id> --command /<workflow-name> --session <host-session-id>
```

Resolve `<runtime-root>` from the checkout first, then `${CODEX_HOME:-$HOME/.codex}/forgeflow`. Architect decisions are `APPROVE`, `CONDITIONAL APPROVE`, `REVISE`, or `BLOCK`; Product Lead decisions are `CONFIRM` or `CHALLENGE`. Record only an explicitly issued decision, never infer approval from passing tests, silence, or an implementation summary. If a final decision is absent, ask the reviewer to state it or leave the outcome unrecorded. Reuse the same event id on retries; use a distinct id for each reviewer and review round, such as `<host-session-id>.review-2.architect`. The helper rejects conflicting reuse and prevents duplicate counts. Session can be omitted when `CODEX_THREAD_ID` or `FORGEFLOW_SESSION_ID` is present. A recording failure must be reported without changing the review result or fabricating history.


## Task evidence continuity

Use the shared task workflow for a bounded change with an accepted objective or brief. Resolve `task.js` from the same runtime helper directory used above. Run `list --root <project-root>` and reuse only the task explicitly selected by the user or matching the current objective and scope. Do not attach an unrelated task based only on recency. If this is a new accepted change, create a task using its objective and behavioral acceptance criteria; the task workflow describes the JSON contract.

Keep the same task id across consult, implement, review and ship. Use `check` for actual validation commands and saved `evidence` for observed manual/reviewer results. Record a `checkpoint` at each completed phase and before interruption, including the actual host/session identity when available. A saved plan, successful build, or reviewer verdict alone must not mark every criterion verified. Waivers require explicit user intent and a reason.

Before reporting completion or preparing a shipping handoff, read `status --root <project-root> --task <id>`. Stale/missing/failed criteria and pending actions remain visible. Reconcile interrupted actions from actual evidence, then use `resume`; never silently replay unknown work. Legacy work without task records stays supported but has no source-bound task completion claim. All remote authorization rules above still apply.

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
