---
name: forgeflow-review
description: Run the Forgeflow review workflow by spawning specialist reviewers, then synthesizing with Arbiter and final-checking with Compass.
---

At workflow entry, run `node <helper-dir>/open-session-dashboard.js --root <project-root> --workflow forgeflow-review` when available. Resolve `<helper-dir>` from the checkout's `scripts/forgeflow` first, then `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. The helper starts or reuses agent-chat and reports known workflow phases on each entry; it uses `CODEX_THREAD_ID`, `CLAUDE_SESSION_ID`, or `FORGEFLOW_SESSION_ID` to open the local dashboard once per session. If the host supplies a session id separately, pass `--session <host-session-id>`; never invent a new id per invocation. Headless runs and `FORGEFLOW_DASHBOARD_AUTO_OPEN=off` skip the launch. A missing helper or unavailable browser must not block the workflow. Report actual phase transitions, significant progress, waiting, and the final result with `node <runtime-root>/services/agent-chat/client.js activity <state> "<short label>"` (`<runtime-root>` is the checkout or installed `forgeflow` directory). Use `complete` only when work and required checks have finished; report `failed` for failures, and never invent progress to keep Ember moving.


Use this skill when the user wants a multi-agent review of current changes, specific files, or a diff against a git ref.

Resolve helpers before running them: set `FORGEFLOW_HELPER_DIR` to `scripts/forgeflow` when that directory exists, otherwise to `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. A missing helper means the Codex runtime installation needs repair; it does not mean review is unsupported in Codex.

Before other work, run:

```bash
"$FORGEFLOW_HELPER_DIR/ensure-forgeflow-state.sh"
```

Workflow:
1. Determine review scope from the user request.
2. Explain the route before spawning agents. Prefer:

```bash
scripts/forgeflow/explain-review-route.js --json
```

   If a calibration summary exists, include it:

```bash
scripts/forgeflow/explain-review-route.js --json --calibration .forgeflow/Forgeflow/calibration-summary.json
```

3. Build a local context pack when the helper exists:

```bash
scripts/forgeflow/build-context-pack.js --json
```

   Pass `--files`, `--lines`, `--mode`, and `--calibration` when those values were already resolved. This also refreshes `.forgeflow/<project>/index/memory-index.json` when local memory exists. Use the generated `agent-packets/<agent>.md` as the primary reviewer context and `synthesis-input.json` for Arbiter/Compass.
4. Run `scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json` and `scripts/forgeflow/advise-context.js --root .forgeflow --record --json` when available. Surface budget warnings, trend deltas, and trim recommendations before spawning reviewers.
5. Read only the files needed for that scope. Prefer exact files or `git diff --name-only`; avoid re-reading files already covered by the context pack unless exact source lines are needed.
6. Spawn reviewer agents in parallel according to the route:
   - `smith_reviewer`
   - `warden_reviewer`
   - `lumen_reviewer`
   - `atlas_reviewer`
7. If the route is thin-mode, you may skip `lumen_reviewer` and `atlas_reviewer`.
8. Before Arbiter synthesis, send high-risk findings through `aegis`:
   - security
   - auth, session, permissions, tenant isolation
   - migration, schema, data loss
   - critical correctness
   - broad refactor regression
   - accessibility blocker
9. Wait for reviewer and verifier outputs, then spawn `arbiter_reviewer` with the collected findings, verifier decisions, routing note, and the file list.
10. Spawn `compass_reviewer` after Arbiter with:
   - Arbiter's verdict
   - reviewer outputs
   - verifier outputs
   - routing note
   - any available plan, research, or discussion notes from `.forgeflow/`
11. Return findings first. Summaries come after findings.

Rules:
- Keep review file-scoped. Do not broaden scope without evidence.
- Review agents should not edit files.
- Persona confidence is not evidence. High-risk claims need neutral verification before becoming blockers.
- Include a routing note in the final response: mode, agents included/skipped, verifier used/skipped, telemetry hints, and why.
- Compass may run targeted tests when that materially improves the review.
- If the user asks for a "review", default to this skill.

Suggested prompts:
- `$forgeflow-review review this branch against main`
- `$forgeflow-review review src/auth.ts and src/routes/session.ts`

## Record explicit review outcomes

After Arbiter or Compass issues an actual final decision, save that decision and its supporting evidence in a project-local report, then record it once with the shared telemetry helper:

```bash
node <runtime-root>/hooks/forgeflow-telemetry.js record-verdict --cwd <project-root> --reviewer <arbiter-or-compass> --verdict "<exact-decision>" --evidence <saved-report-relative-path> --event-id <stable-outcome-id> --command /<workflow-name> --session <host-session-id>
```

Resolve `<runtime-root>` from the checkout first, then `${CODEX_HOME:-$HOME/.codex}/forgeflow`. Arbiter decisions are `APPROVE`, `CONDITIONAL APPROVE`, `REVISE`, or `BLOCK`; Compass decisions are `CONFIRM` or `CHALLENGE`. Record only an explicitly issued decision, never infer approval from passing tests, silence, or an implementation summary. If a final decision is absent, ask the reviewer to state it or leave the outcome unrecorded. Reuse the same event id on retries; use a distinct id for each reviewer and review round, such as `<host-session-id>.review-2.arbiter`. The helper rejects conflicting reuse and prevents duplicate counts. Session can be omitted when `CODEX_THREAD_ID` or `FORGEFLOW_SESSION_ID` is present. A recording failure must be reported without changing the review result or fabricating history.
