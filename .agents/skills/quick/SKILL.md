---
name: quick
description: Run a lightweight Forgeflow routing workflow that picks a small set of relevant agents for a task.
---

At workflow entry, run `node <helper-dir>/open-session-dashboard.js --root <project-root> --workflow quick` when available. Resolve `<helper-dir>` from the checkout's `scripts/forgeflow` first, then `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. The helper starts or reuses agent-chat and reports known workflow phases on each entry; it uses `CODEX_THREAD_ID`, `CLAUDE_SESSION_ID`, or `FORGEFLOW_SESSION_ID` to open the local dashboard once per session. If the host supplies a session id separately, pass `--session <host-session-id>`; never invent a new id per invocation. Headless runs and `FORGEFLOW_DASHBOARD_AUTO_OPEN=off` skip the launch. A missing helper or unavailable browser must not block the workflow. Report actual phase transitions, significant progress, waiting, and the final result with `node <runtime-root>/services/agent-chat/client.js activity <state> "<short label>"` (`<runtime-root>` is the checkout or installed `forgeflow` directory). Use `complete` only when work and required checks have finished; report `failed` for failures, and never invent progress to keep Ember moving.


Use this skill when the user wants a fast forgeflow-assisted response without the full lifecycle.

Workflow:
1. Read the task and determine which Forgeflow agents are relevant.
2. Prefer the minimum useful set of agents.
3. If one clearly dominates, spawn only that agent.
4. Otherwise spawn the small relevant set, gather outputs, and summarize.

Rules:
- Bias toward speed and relevance.
- Do not fan out broadly unless the task genuinely needs it.
