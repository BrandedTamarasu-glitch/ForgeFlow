---
name: consult
description: Short alias for the Forgeflow consultation workflow that produces an implementation brief before coding.
---

At workflow entry, run `node <helper-dir>/open-session-dashboard.js --root <project-root> --workflow consult` when available. Resolve `<helper-dir>` from the checkout's `scripts/forgeflow` first, then `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. The helper starts or reuses agent-chat and reports known workflow phases on each entry; it uses `CODEX_THREAD_ID`, `CLAUDE_SESSION_ID`, or `FORGEFLOW_SESSION_ID` to open the local dashboard once per session. If the host supplies a session id separately, pass `--session <host-session-id>`; never invent a new id per invocation. Headless runs and `FORGEFLOW_DASHBOARD_AUTO_OPEN=off` skip the launch. A missing helper or unavailable browser must not block the workflow. Report actual phase transitions, significant progress, waiting, and the final result with `node <runtime-root>/services/agent-chat/client.js activity <state> "<short label>"` (`<runtime-root>` is the checkout or installed `forgeflow` directory). Use `complete` only when work and required checks have finished; report `failed` for failures, and never invent progress to keep Ember moving.


Delegate to the `forgeflow-consult` workflow.

Use this skill when the user wants Forgeflow consultation before implementation.

Resolve helpers before running them: set `FORGEFLOW_HELPER_DIR` to `scripts/forgeflow` when that directory exists, otherwise to `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. If neither exists, report a missing Codex runtime installation.

Before other work, run:

```bash
"$FORGEFLOW_HELPER_DIR/ensure-forgeflow-state.sh"
```

Workflow:
1. Read the [canonical consultation skill](../forgeflow-consult/SKILL.md) and follow its complete workflow, including consultation routing. If the canonical skill is unavailable, report the missing instructions instead of inventing a separate route.
2. Use its smallest relevant specialist set, risk/uncertainty escalation, and Architect synthesis. This alias does not require all four consultants or skip independent validation and final review.

If both this alias and `forgeflow-consult` are available, treat them as equivalent.


## Task evidence continuity

Use the shared task workflow for a bounded change with an accepted objective or brief. Resolve `task.js` from the same runtime helper directory used above. Run `list --root <project-root>` and reuse only the task explicitly selected by the user or matching the current objective and scope. Do not attach an unrelated task based only on recency. If this is a new accepted change, create a task using its objective and behavioral acceptance criteria; the task workflow describes the JSON contract.

Keep the same task id across consult, implement, review and ship. Use `check` for actual validation commands and saved `evidence` for observed manual/reviewer results. Record a `checkpoint` at each completed phase and before interruption, including the actual host/session identity when available. A saved plan, successful build, or reviewer verdict alone must not mark every criterion verified. Waivers require explicit user intent and a reason.

Before reporting completion or preparing a shipping handoff, read `status --root <project-root> --task <id>`. Stale/missing/failed criteria and pending actions remain visible. Reconcile interrupted actions from actual evidence, then use `resume`; never silently replay unknown work. Legacy work without task records stays supported but has no source-bound task completion claim. All remote authorization rules above still apply.
