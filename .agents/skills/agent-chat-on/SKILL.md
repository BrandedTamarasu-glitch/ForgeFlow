---
name: agent-chat-on
description: Start the Forgeflow agent-chat server and report its status.
---

Use this skill when the user wants the local agent-chat service running.

Resolve helpers from `scripts/forgeflow` in a checkout or `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow` in an installed Codex runtime. Missing helpers are an installation issue, not an unsupported Codex feature.

Workflow:
1. Run:

```bash
scripts/forgeflow/agent-chat-on.sh
```

2. Report the dashboard and websocket endpoints from the script output.
3. If startup fails because dependencies are missing, surface that clearly and stop.
