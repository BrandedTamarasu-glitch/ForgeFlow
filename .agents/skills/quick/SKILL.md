---
name: quick
description: Run a lightweight Forgeflow routing workflow that picks a small set of relevant agents for a task.
---

Use this skill when the user wants a fast forgeflow-assisted response without the full lifecycle.

Workflow:
1. Read the task and determine which Forgeflow agents are relevant.
2. Prefer the minimum useful set of agents.
3. If one clearly dominates, spawn only that agent.
4. Otherwise spawn the small relevant set, gather outputs, and summarize.

Rules:
- Bias toward speed and relevance.
- Do not fan out broadly unless the task genuinely needs it.
