---
name: agent-chat-on
description: Start the Forgeflow agent-chat server and report its status.
---

Use this skill when the user wants the local agent-chat service running.

Workflow:
1. Run:

```bash
scripts/forgeflow/agent-chat-on.sh
```

2. Report the dashboard and websocket endpoints from the script output.
3. If startup fails because dependencies are missing, surface that clearly and stop.
