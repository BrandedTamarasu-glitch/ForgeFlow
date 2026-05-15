---
name: update-forgeflow
description: Update the local Forgeflow repo or Codex port from the source repository.
---

Use this skill when the user wants to sync this local Forgeflow copy with the upstream repository.

Workflow:
1. Check the local git remote and current branch state.
2. Fetch remote changes.
3. Show the incoming diff or commit range.
4. If the user wants to proceed and approvals allow it, pull or re-clone as appropriate.
5. Preserve project-local Codex additions unless the user explicitly asks to overwrite them.

Rules:
- Never overwrite local custom Codex assets without clear user intent.
- Use non-destructive git operations.
