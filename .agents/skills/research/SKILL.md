---
name: research
description: Run the Forgeflow research workflow to evaluate options, prior art, codebase patterns, and risks.
---

At workflow entry, run `node <helper-dir>/open-session-dashboard.js --root <project-root> --workflow research` when available. Resolve `<helper-dir>` from the checkout's `scripts/forgeflow` first, then `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. The helper starts or reuses agent-chat and reports known workflow phases on each entry; it uses `CODEX_THREAD_ID`, `CLAUDE_SESSION_ID`, or `FORGEFLOW_SESSION_ID` to open the local dashboard once per session. If the host supplies a session id separately, pass `--session <host-session-id>`; never invent a new id per invocation. Headless runs and `FORGEFLOW_DASHBOARD_AUTO_OPEN=off` skip the launch. A missing helper or unavailable browser must not block the workflow. Report actual phase transitions, significant progress, waiting, and the final result with `node <runtime-root>/services/agent-chat/client.js activity <state> "<short label>"` (`<runtime-root>` is the checkout or installed `forgeflow` directory). Use `complete` only when work and required checks have finished; report `failed` for failures, and never invent progress to keep Ember moving.


Use this skill when the user wants research after discussion and before planning. Route focused tasks automatically with `render-research-divergence-advice.js`; divergence is the default policy outcome only when the helper recommends it.

Resolve helpers before running them: use `scripts/forgeflow` from the current checkout when present; otherwise use `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. If neither exists, report a missing Codex runtime installation.

Parse `--diverge` and `--no-diverge` first. Reject both together. `--diverge` forces divergence; `--no-diverge` forces normal research. With neither flag and a focused task, run:

```bash
node scripts/forgeflow/render-research-divergence-advice.js --task "<focused task>" --json
```

Use its recommendation and disclose the reason plus the exploratory latency/token tradeoff. With no focused task, use normal research and disclose that automatic routing needs a focused task. The user may override every automatic result.

For the normal workflow only, before other work run:

```bash
scripts/forgeflow/ensure-forgeflow-state.sh
```

Route selection must happen before this command. Divergent research is read-only: do not initialize state, build memory context, emit telemetry, or write any project file. Existing context may be read only for the independent Coordinator evidence lane and later Product Lead critic.

Default workflow:
1. Load `.forgeflow/<project-name>/current-discussion.md` if present, plus any focused user questions.
2. Build compact local memory context with `scripts/forgeflow/build-memory-context.js` when available, then gather `CONTEXT.md` files and other narrowly relevant local context.
3. Spawn `product_lead_researcher` and `coordinator_early` in parallel.
4. Synthesize Product Lead's recommendations with Coordinator's codebase and memory findings.
5. Save the result to `.forgeflow/<project-name>/current-research.md` when appropriate.

`--diverge` workflow:
1. Run a preflight. Divergence is intended for open-ended, consequential choices with multiple plausible approaches. If automatic routing selected it for a lookup, a known-root-cause bug, a canonical-answer question, or a low-stakes choice, use the normal workflow and explain why. An explicit `--diverge` override still proceeds.
2. Do not inject project memory, discussion artifacts, existing recommendations, codebase evidence, or peer output into divergent branches. Extract only the task and immutable constraints. When available, use `scripts/forgeflow/render-research-divergence.js` (or the installed-runtime equivalent described above) to render the three deterministic branch packets, then launch the fixed frames in parallel:
   - `inversion`: assume the obvious approach fails; identify the opposite design and the conditions that make it work.
   - `remove-assumption`: remove one load-bearing assumption and derive a viable approach from the resulting constraint set.
   - `3am-on-call`: optimize for diagnosis, containment, and safe recovery by a tired on-call engineer.
3. Give each branch exactly the task, immutable constraints, its single frame, and the required candidate format. Keep lanes isolated. Treat frames as temporary reasoning instructions, not permanent agent roles.
4. Make missing or failed lanes visible. Retry each failed lane once; if it still fails, continue with the remaining lanes and label the result degraded. Never invent branch output.
5. Independently gather normal codebase and memory evidence with `coordinator_early`; never expose it to the branches. After all lanes settle, give their outputs to a separate `product_lead_researcher` critic together with the normal discussion, compact memory, Coordinator evidence, and accessibility context. The critic must return:
   - clusters by underlying approach and duplicated/shared assumptions
   - a shortlist of two to four candidates
   - for every shortlisted candidate: strength, attraction, hidden trap with its concrete mechanism, disconfirming test, salvage condition, and first implementation step
   - one non-obvious viable candidate
   - a load-bearing risk, first falsification experiment, and final recommendation
6. Raw lane prompts and outputs are ephemeral. Do not write them to `current-research.md`, project memory, memory-context inputs, `CONTEXT.md`, or any indexed artifact. Present the critic's converged decision content to the user without saving it; the entire divergent route is no-write.

On Claude, use the corresponding `product-lead-research`/`coordinator-early` agents; on Codex, use `product_lead_researcher`/`coordinator_early`. Preserve the isolation and critic boundaries on both hosts.

Output should include:
- options considered
- codebase patterns
- risks and tradeoffs
- accessibility implications
- clear recommendation

For `--diverge`, also include route rationale, lane status, clusters, the structured trap ledger, the non-obvious viable candidate, and the falsification experiment. Mark degraded results prominently.

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
