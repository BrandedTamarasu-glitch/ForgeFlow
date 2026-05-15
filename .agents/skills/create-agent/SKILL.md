---
name: create-agent
description: Create a new Codex custom agent for this project by gathering requirements and writing a TOML agent file.
---

Use this skill when the user wants a new project-specific Codex agent.

Workflow:
1. Ask only for the minimum needed information if local context is insufficient:
   - name
   - purpose
   - model preference if any
   - sandbox mode
   - tone/behavior
2. Generate a focused TOML agent under `.codex/agents/`.
3. Keep it narrow and opinionated.
4. Explain how to invoke it in Codex.

Rules:
- Create Codex-native agents, not Claude markdown agents.
- Prefer project-scoped agents in `.codex/agents/`.
