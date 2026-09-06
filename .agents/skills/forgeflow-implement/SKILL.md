---
name: forgeflow-implement
description: Run the Forgeflow implementation workflow using an implementation brief, with Compass handling validation and Arbiter checking integration.
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
   - `smith_implementer`
   - `warden_implementer`
   - `lumen_implementer`
   - `atlas_implementer`
   - `compass_validator`
8. After implementation work finishes, spawn `arbiter_implementer` to check fit, interfaces, and any minimal integration glue.
9. Report what changed, what was validated, and any remaining risks.

Rules:
- Keep each subagent on a disjoint write scope whenever possible.
- Prefer the smallest defensible patch set.
- Follow lean decision guidance only when it fits the confirmed brief; never use it to remove explicit requirements, security, accessibility, validation, or data-loss safeguards.
- When implementation takes a smaller path, record the known ceiling and upgrade trigger in implementation notes.
- Compass focuses on tests and validation artifacts, not product code.
- Atlas owns coordination and memory, not implementation churn.

Suggested prompts:
- `$forgeflow-implement execute the current brief`
- `$forgeflow-implement implement the brief in docs/briefs/login.md`

## Record explicit review outcomes

After Arbiter or Compass issues an actual final decision, save that decision and its supporting evidence in a project-local report, then record it once with the shared telemetry helper:

```bash
node <runtime-root>/hooks/forgeflow-telemetry.js record-verdict --cwd <project-root> --reviewer <arbiter-or-compass> --verdict "<exact-decision>" --evidence <saved-report-relative-path> --event-id <stable-outcome-id> --command /<workflow-name> --session <host-session-id>
```

Resolve `<runtime-root>` from the checkout first, then `${CODEX_HOME:-$HOME/.codex}/forgeflow`. Arbiter decisions are `APPROVE`, `CONDITIONAL APPROVE`, `REVISE`, or `BLOCK`; Compass decisions are `CONFIRM` or `CHALLENGE`. Record only an explicitly issued decision, never infer approval from passing tests, silence, or an implementation summary. If a final decision is absent, ask the reviewer to state it or leave the outcome unrecorded. Reuse the same event id on retries; use a distinct id for each reviewer and review round, such as `<host-session-id>.review-2.arbiter`. The helper rejects conflicting reuse and prevents duplicate counts. Session can be omitted when `CODEX_THREAD_ID` or `FORGEFLOW_SESSION_ID` is present. A recording failure must be reported without changing the review result or fabricating history.
