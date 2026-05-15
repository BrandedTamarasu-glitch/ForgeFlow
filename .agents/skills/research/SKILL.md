---
name: research
description: Run the Forgeflow research workflow to evaluate options, prior art, codebase patterns, and risks.
---

Use this skill when the user wants research after discussion and before planning.

Before other work, run:

```bash
scripts/forgeflow/ensure-forgeflow-state.sh
```

Workflow:
1. Load `.forgeflow/<project-name>/current-discussion.md` if present, plus any focused user questions.
2. Gather `CONTEXT.md` files and other narrowly relevant local context.
3. Spawn `compass_researcher` and `atlas_early` in parallel.
4. Synthesize Compass's recommendations with Atlas's codebase and memory findings.
5. Save the result to `.forgeflow/<project-name>/current-research.md` when appropriate.

Output should include:
- options considered
- codebase patterns
- risks and tradeoffs
- accessibility implications
- clear recommendation
