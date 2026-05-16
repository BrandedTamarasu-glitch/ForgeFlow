---
name: update-forgeflow
description: Update the local Forgeflow repo or Codex port from the source repository.
---

Use this skill when the user wants to sync this local Forgeflow copy with the upstream repository.

For consumer Claude installs, `/update-forgeflow` is the no-clone installer. It syncs agents, commands, hooks, templates, project rules, patterns, and runtime helpers into `~/.claude/`, with helper scripts under `~/.claude/forgeflow/scripts/forgeflow/`.

Workflow:
1. Check the local git remote and current branch state.
2. Fetch remote changes.
3. Show the incoming diff or commit range.
4. If the user wants to proceed and approvals allow it, pull or re-clone as appropriate.
5. Preserve project-local Codex additions unless the user explicitly asks to overwrite them.
6. If the user asks about the Claude installer path instead of repo sync, inspect `commands/update-forgeflow.md` and the install manifest before changing behavior.

Rules:
- Never overwrite local custom Codex assets without clear user intent.
- Use non-destructive git operations.
