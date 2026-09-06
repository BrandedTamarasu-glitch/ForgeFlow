---
name: implement
description: Short alias for the Forgeflow implementation workflow driven by the current implementation brief.
---

At workflow entry, run `node <helper-dir>/open-session-dashboard.js --root <project-root>` when available. Resolve `<helper-dir>` from the checkout's `scripts/forgeflow` first, then `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. The helper uses `CODEX_THREAD_ID`, `CLAUDE_SESSION_ID`, or `FORGEFLOW_SESSION_ID` to open the local dashboard once per session. If the host supplies a session id separately, pass `--session <host-session-id>`; never invent a new id per invocation. Headless runs and `FORGEFLOW_DASHBOARD_AUTO_OPEN=off` skip the launch. A missing helper or unavailable browser must not block the workflow.


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
