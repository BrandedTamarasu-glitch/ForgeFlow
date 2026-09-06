---
name: audit
description: Run a deep Forgeflow audit across the codebase or a focused subsystem for security, systems, schema, and architectural debt.
---

At workflow entry, run `node <helper-dir>/open-session-dashboard.js --root <project-root> --workflow audit` when available. Resolve `<helper-dir>` from the checkout's `scripts/forgeflow` first, then `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. The helper starts or reuses agent-chat and reports known workflow phases on each entry; it uses `CODEX_THREAD_ID`, `CLAUDE_SESSION_ID`, or `FORGEFLOW_SESSION_ID` to open the local dashboard once per session. If the host supplies a session id separately, pass `--session <host-session-id>`; never invent a new id per invocation. Headless runs and `FORGEFLOW_DASHBOARD_AUTO_OPEN=off` skip the launch. A missing helper or unavailable browser must not block the workflow. Report actual phase transitions, significant progress, waiting, and the final result with `node <runtime-root>/services/agent-chat/client.js activity <state> "<short label>"` (`<runtime-root>` is the checkout or installed `forgeflow` directory). Use `complete` only when work and required checks have finished; report `failed` for failures, and never invent progress to keep Ember moving.


Use this skill when the user wants a deep audit rather than a PR-style review.

Resolve helpers before running them: use `scripts/forgeflow` from the current checkout when present; otherwise use `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. If neither exists, report that the Codex Forgeflow runtime needs repair instead of claiming the workflow is unsupported.

Before other work, run:

```bash
"$FORGEFLOW_HELPER_DIR/ensure-forgeflow-state.sh"
```

Workflow:
1. Determine audit scope from the user request.
2. Gather focused context and representative files for that scope.
3. Spawn `smith_auditor` and `warden_auditor` in parallel.
4. Synthesize with `arbiter_reviewer`.
5. Optionally persist the results into `.forgeflow/<project-name>/` memory files.

Output should include:
- Critical
- High
- Medium
- Low
- Highlights
