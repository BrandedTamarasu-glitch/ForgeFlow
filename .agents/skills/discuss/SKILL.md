---
name: discuss
description: Start the Forgeflow discussion workflow to frame the problem, requirements, accessibility needs, and open questions.
---

Use this skill when the user wants to shape the problem before research or implementation.

Resolve helpers before running them: set `FORGEFLOW_HELPER_DIR` to `scripts/forgeflow` when that directory exists, otherwise to `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. If neither exists, report a missing Codex runtime installation.

Before other work, run:

```bash
"$FORGEFLOW_HELPER_DIR/ensure-forgeflow-state.sh"
```

Workflow:
1. Gather the task description and any existing spec or context files.
2. Spawn `compass_discusser` as the lead.
3. Spawn `atlas_early` in parallel for memory, scope validation, and codebase context.
4. Synthesize the result into a discussion summary.
5. Save it to `.forgeflow/<project-name>/current-discussion.md` when appropriate.

Output should include:
- problem framing
- must/should/nice-to-have requirements
- accessibility requirements
- UX direction
- open questions
