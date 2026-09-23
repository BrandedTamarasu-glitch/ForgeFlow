---
name: implement
description: Short alias for the Forgeflow implementation workflow driven by the current implementation brief.
---

<!-- forgeflow-capability-selection:start -->
## Automatic capability selection

Resolve `select-capabilities.js` from the checkout `scripts/forgeflow`, a host-supplied plugin root, or the installed ForgeFlow runtime for this host. Run `node <helper-dir>/select-capabilities.js --guide` and follow the shared selection procedure with phase **implement** and the current objective, criteria and affected scope. Reuse the same result across alias handoffs and pass it through existing context construction; do not reset reassessment limits. Missing runtime support is an explicit limitation, not a reason to invent selection results. Preserve current workflow read-only and isolation boundaries. Planned capabilities are not executable and selection grants no new authority.
<!-- forgeflow-capability-selection:end -->

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
3. Spawn the needed implementers plus `product_lead_validator`.
4. Finish with `architect_implementer` for integration checking.

If both this alias and `forgeflow-implement` are available, treat them as equivalent.

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

## Local-only workflow boundary
- Treat every `.forgeflow/` directory, its contents, and workflow agent identities as local working context only. Never stage, commit, push, attach, upload, or sync this state, including through memory-sync commands. Use Git's local `info/exclude` for generated state; never force-add it. Ignore rules do not protect already tracked files.
- Never include local artifact paths, agent names, persona names, role labels, agent verdict attribution, or workflow signatures in PR titles, bodies, comments, commit messages, release notes, or published artifacts. Describe the change and observed validation in ordinary engineering language. Keep detailed review attribution and evidence links in local reports.
- Never insert workflow agent identities or local evidence references into application source, comments, docstrings, tests, fixtures, identifiers, UI text, or shipped documentation. Use domain-based names and explain technical reasons without agent attribution.
- Before staging or publishing, inspect the actual staged diff, outgoing commits, and public text. A local-state file or workflow attribution leak blocks the action until corrected. Do not silently delete local evidence or rewrite existing history; report already tracked or committed state for cleanup.
- These rules govern project work produced with Forgeflow. Forgeflow's own maintained agent definitions, integration code, and documentation may name the agents and state paths needed to implement the tool; generated session state is always local. Ordinary domain terms that happen to match a role name are not workflow attribution.
- Local CLI labels, orchestration messages, and local report schemas may retain identities. This boundary takes precedence over instructions to copy local reports into public output or sync session memory.
