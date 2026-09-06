---
name: consult
description: Short alias for the Forgeflow consultation workflow that produces an implementation brief before coding.
---

At workflow entry, run `node <helper-dir>/open-session-dashboard.js --root <project-root>` when available. Resolve `<helper-dir>` from the checkout's `scripts/forgeflow` first, then `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. The helper uses `CODEX_THREAD_ID`, `CLAUDE_SESSION_ID`, or `FORGEFLOW_SESSION_ID` to open the local dashboard once per session. If the host supplies a session id separately, pass `--session <host-session-id>`; never invent a new id per invocation. Headless runs and `FORGEFLOW_DASHBOARD_AUTO_OPEN=off` skip the launch. A missing helper or unavailable browser must not block the workflow.


Delegate to the `forgeflow-consult` workflow.

Use this skill when the user wants Forgeflow consultation before implementation.

Resolve helpers before running them: set `FORGEFLOW_HELPER_DIR` to `scripts/forgeflow` when that directory exists, otherwise to `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. If neither exists, report a missing Codex runtime installation.

Before other work, run:

```bash
"$FORGEFLOW_HELPER_DIR/ensure-forgeflow-state.sh"
```

Workflow:
1. Build compact local memory context with `scripts/forgeflow/build-memory-context.js` when available, build first-pass file ownership packets with `scripts/forgeflow/build-scope-manifest.js` when available, and run `scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json` when available.
2. Spawn `smith_consultant`, `warden_consultant`, `lumen_consultant`, and `atlas_consultant` in parallel.
3. Synthesize with `arbiter_consultant`.
4. Save the resulting brief to `.forgeflow/<project-name>/current-brief.md` when appropriate.

If both this alias and `forgeflow-consult` are available, treat them as equivalent.
