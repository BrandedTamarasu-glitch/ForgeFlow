---
name: discuss
description: Start the Forgeflow discussion workflow to frame the problem, requirements, accessibility needs, and open questions.
---

At workflow entry, run `node <helper-dir>/open-session-dashboard.js --root <project-root> --workflow discuss` when available. Resolve `<helper-dir>` from the checkout's `scripts/forgeflow` first, then `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. The helper starts or reuses agent-chat and reports known workflow phases on each entry; it uses `CODEX_THREAD_ID`, `CLAUDE_SESSION_ID`, or `FORGEFLOW_SESSION_ID` to open the local dashboard once per session. If the host supplies a session id separately, pass `--session <host-session-id>`; never invent a new id per invocation. Headless runs and `FORGEFLOW_DASHBOARD_AUTO_OPEN=off` skip the launch. A missing helper or unavailable browser must not block the workflow. Report actual phase transitions, significant progress, waiting, and the final result with `node <runtime-root>/services/agent-chat/client.js activity <state> "<short label>"` (`<runtime-root>` is the checkout or installed `forgeflow` directory). Use `complete` only when work and required checks have finished; report `failed` for failures, and never invent progress to keep Ember moving.


Use this skill when the user wants to shape the problem before research or implementation.

Resolve helpers before running them: set `FORGEFLOW_HELPER_DIR` to `scripts/forgeflow` when that directory exists, otherwise to `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. If neither exists, report a missing Codex runtime installation.

Before other work, run:

```bash
"$FORGEFLOW_HELPER_DIR/ensure-forgeflow-state.sh"
```

Workflow:
1. Gather the task description and any existing spec or context files.
2. Spawn `compass_discusser` as the lead.
3. Spawn `atlas_early` in parallel for memory, scope validation, and codebase context.
4. Synthesize the result into a discussion summary.
5. Save it to `.forgeflow/<project-name>/current-discussion.md` when appropriate.

Output should include:
- problem framing
- must/should/nice-to-have requirements
- accessibility requirements
- UX direction
- open questions
