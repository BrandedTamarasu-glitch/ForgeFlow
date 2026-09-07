---
name: ship
description: Final Forgeflow shipping workflow for presentation generation, PR preparation, CI monitoring, and failure follow-up.
---

At workflow entry, run `node <helper-dir>/open-session-dashboard.js --root <project-root> --workflow ship` when available. Resolve `<helper-dir>` from the checkout's `scripts/forgeflow` first, then `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. The helper starts or reuses agent-chat and reports known workflow phases on each entry; it uses `CODEX_THREAD_ID`, `CLAUDE_SESSION_ID`, or `FORGEFLOW_SESSION_ID` to open the local dashboard once per session. If the host supplies a session id separately, pass `--session <host-session-id>`; never invent a new id per invocation. Headless runs and `FORGEFLOW_DASHBOARD_AUTO_OPEN=off` skip the launch. A missing helper or unavailable browser must not block the workflow. Report actual phase transitions, significant progress, waiting, and the final result with `node <runtime-root>/services/agent-chat/client.js activity <state> "<short label>"` (`<runtime-root>` is the checkout or installed `forgeflow` directory). Use `complete` only when work and required checks have finished; report `failed` for failures, and never invent progress to keep Ember moving.


Use this skill when the user explicitly wants to ship the branch.

Resolve helpers before running them: set `FORGEFLOW_HELPER_DIR` to `scripts/forgeflow` when that directory exists, otherwise to `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. A missing helper means the Codex runtime installation needs repair; it does not mean shipping is unsupported in Codex.

Start by running:

```bash
"$FORGEFLOW_HELPER_DIR/ensure-forgeflow-state.sh"
"$FORGEFLOW_HELPER_DIR/ship-prepare.sh" "<optional title>"
```

`ship-prepare.sh` creates:
- `.forgeflow/<project-name>/ship/ship-summary.json`
- `.forgeflow/<project-name>/ship/ship-presentation.html`
- `.forgeflow/<project-name>/ship/pr-body.md`

Workflow:
1. Verify recent review state and confirm the branch is ready to ship.
2. Gather summary context from git history, changed files, and `.forgeflow/` artifacts.
3. Review and refine the generated ship artifacts instead of rebuilding them from scratch.
4. If asked and approvals allow it, create or update the PR with:

```bash
scripts/forgeflow/ship-open-pr.sh "<title>" ".forgeflow/<project-name>/ship/pr-body.md" "<base-branch>"
```

5. If asked and approvals allow it, check CI status with:

```bash
scripts/forgeflow/ship-ci-status.sh
scripts/forgeflow/ship-ci-status.sh --watch
```

6. If CI fails and the user wants fixes, route the failure to the most relevant implementer(s).

Rules:
- Do not push, create PRs, or mutate remote state without the required approvals.
- Treat review gating as real, not ceremonial.
- Keep presentation content accurate and tightly grounded in the actual diff.
- Prefer updating the generated artifacts instead of discarding them.


## Task evidence continuity

Use the shared task workflow for a bounded change with an accepted objective or brief. Resolve `task.js` from the same runtime helper directory used above. Run `list --root <project-root>` and reuse only the task explicitly selected by the user or matching the current objective and scope. Do not attach an unrelated task based only on recency. If this is a new accepted change, create a task using its objective and behavioral acceptance criteria; the task workflow describes the JSON contract.

Keep the same task id across consult, implement, review and ship. Use `check` for actual validation commands and saved `evidence` for observed manual/reviewer results. Record a `checkpoint` at each completed phase and before interruption, including the actual host/session identity when available. A saved plan, successful build, or reviewer verdict alone must not mark every criterion verified. Waivers require explicit user intent and a reason.

Before reporting completion or preparing a shipping handoff, read `status --root <project-root> --task <id>`. Stale/missing/failed criteria and pending actions remain visible. Reconcile interrupted actions from actual evidence, then use `resume`; never silently replay unknown work. Legacy work without task records stays supported but has no source-bound task completion claim. All remote authorization rules above still apply.
