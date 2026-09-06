---
name: implement
description: Short alias for the Forgeflow implementation workflow driven by the current implementation brief.
---

At workflow entry, run `node <helper-dir>/open-session-dashboard.js --root <project-root> --workflow implement` when available. Resolve `<helper-dir>` from the checkout's `scripts/forgeflow` first, then `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. The helper starts or reuses agent-chat and reports known workflow phases on each entry; it uses `CODEX_THREAD_ID`, `CLAUDE_SESSION_ID`, or `FORGEFLOW_SESSION_ID` to open the local dashboard once per session. If the host supplies a session id separately, pass `--session <host-session-id>`; never invent a new id per invocation. Headless runs and `FORGEFLOW_DASHBOARD_AUTO_OPEN=off` skip the launch. A missing helper or unavailable browser must not block the workflow. Report actual phase transitions, significant progress, waiting, and the final result with `node <runtime-root>/services/agent-chat/client.js activity <state> "<short label>"` (`<runtime-root>` is the checkout or installed `forgeflow` directory). Use `complete` only when work and required checks have finished; report `failed` for failures, and never invent progress to keep Ember moving.


Delegate to the `forgeflow-implement` workflow.

Use this skill when the user wants Forgeflow implementation using the current brief.

Resolve helpers before running them: set `FORGEFLOW_HELPER_DIR` to `scripts/forgeflow` when that directory exists, otherwise to `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. If neither exists, report a missing Codex runtime installation.

Before other work, run:

```bash
"$FORGEFLOW_HELPER_DIR/ensure-forgeflow-state.sh"
```

Workflow:
1. Load `.forgeflow/<project-name>/current-brief.md` unless another brief is specified.
2. Build compact local memory context with `scripts/forgeflow/build-memory-context.js`, first-pass file ownership packets with `scripts/forgeflow/build-scope-manifest.js`, context budget warnings with `scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json`, and trend-aware trim recommendations with `scripts/forgeflow/advise-context.js --root .forgeflow --record --json` when available, then resolve remaining file ownership gaps before edits.
3. Spawn the needed implementers plus `compass_validator`.
4. Finish with `arbiter_implementer` for integration checking.

If both this alias and `forgeflow-implement` are available, treat them as equivalent.

## Record explicit review outcomes

After Arbiter or Compass issues an actual final decision, save that decision and its supporting evidence in a project-local report, then record it once with the shared telemetry helper:

```bash
node <runtime-root>/hooks/forgeflow-telemetry.js record-verdict --cwd <project-root> --reviewer <arbiter-or-compass> --verdict "<exact-decision>" --evidence <saved-report-relative-path> --event-id <stable-outcome-id> --command /<workflow-name> --session <host-session-id>
```

Resolve `<runtime-root>` from the checkout first, then `${CODEX_HOME:-$HOME/.codex}/forgeflow`. Arbiter decisions are `APPROVE`, `CONDITIONAL APPROVE`, `REVISE`, or `BLOCK`; Compass decisions are `CONFIRM` or `CHALLENGE`. Record only an explicitly issued decision, never infer approval from passing tests, silence, or an implementation summary. If a final decision is absent, ask the reviewer to state it or leave the outcome unrecorded. Reuse the same event id on retries; use a distinct id for each reviewer and review round, such as `<host-session-id>.review-2.arbiter`. The helper rejects conflicting reuse and prevents duplicate counts. Session can be omitted when `CODEX_THREAD_ID` or `FORGEFLOW_SESSION_ID` is present. A recording failure must be reported without changing the review result or fabricating history.
