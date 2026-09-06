---
name: forge-review
description: Short alias for the Forgeflow multi-agent review workflow.
---

At workflow entry, run `node <helper-dir>/open-session-dashboard.js --root <project-root>` when available. Resolve `<helper-dir>` from the checkout's `scripts/forgeflow` first, then `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. The helper uses `CODEX_THREAD_ID`, `CLAUDE_SESSION_ID`, or `FORGEFLOW_SESSION_ID` to open the local dashboard once per session. If the host supplies a session id separately, pass `--session <host-session-id>`; never invent a new id per invocation. Headless runs and `FORGEFLOW_DASHBOARD_AUTO_OPEN=off` skip the launch. A missing helper or unavailable browser must not block the workflow.


Delegate to the `forgeflow-review` workflow.

Use this skill when the user wants Forgeflow review of a diff, branch, or file set.

Workflow:
1. Determine the review scope.
2. Spawn the specialist reviewers in parallel.
3. Synthesize with `arbiter_reviewer`.
4. Final-check with `compass_reviewer`.

If both this alias and `forgeflow-review` are available, treat them as equivalent.
