---
name: plan
description: Run the Forgeflow planning workflow to build a phased implementation plan with scope, dependencies, validation, and accessibility.
---

At workflow entry, run `node <helper-dir>/open-session-dashboard.js --root <project-root> --workflow plan` when available. Resolve `<helper-dir>` from the checkout's `scripts/forgeflow` first, then `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. The helper starts or reuses agent-chat and reports known workflow phases on each entry; it uses `CODEX_THREAD_ID`, `CLAUDE_SESSION_ID`, or `FORGEFLOW_SESSION_ID` to open the local dashboard once per session. If the host supplies a session id separately, pass `--session <host-session-id>`; never invent a new id per invocation. Headless runs and `FORGEFLOW_DASHBOARD_AUTO_OPEN=off` skip the launch. A missing helper or unavailable browser must not block the workflow. Report actual phase transitions, significant progress, waiting, and the final result with `node <runtime-root>/services/agent-chat/client.js activity <state> "<short label>"` (`<runtime-root>` is the checkout or installed `forgeflow` directory). Use `complete` only when work and required checks have finished; report `failed` for failures, and never invent progress to keep Ember moving.


Use this skill when the user wants a concrete implementation plan before consultation or coding.

Resolve helpers before running them: set `FORGEFLOW_HELPER_DIR` to `scripts/forgeflow` when that directory exists, otherwise to `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. If neither exists, report a missing Codex runtime installation.

Before other work, run:

```bash
"$FORGEFLOW_HELPER_DIR/ensure-forgeflow-state.sh"
```

Workflow:
1. Build compact local memory context with `scripts/forgeflow/build-memory-context.js` when available, then load current discussion and research artifacts from `.forgeflow/<project-name>/` when needed.
2. Gather focused local context such as `CONTEXT.md`.
3. Spawn `compass_planner` and `atlas_early` in parallel.
4. Synthesize the result into a unified implementation plan.
5. Save it to `.forgeflow/<project-name>/current-plan.md` when appropriate.

Output should include:
- phases and deliverables
- in-scope / out-of-scope / deferred
- dependencies and coordination risks
- accessibility checklist
- success criteria
