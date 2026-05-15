---
name: plan
description: Run the Forgeflow planning workflow to build a phased implementation plan with scope, dependencies, validation, and accessibility.
---

Use this skill when the user wants a concrete implementation plan before consultation or coding.

Before other work, run:

```bash
scripts/forgeflow/ensure-forgeflow-state.sh
```

Workflow:
1. Build compact local memory context with `scripts/forgeflow/build-memory-context.js` when available, then load current discussion and research artifacts from `.forgeflow/<project-name>/` when needed.
2. Gather focused local context such as `CONTEXT.md`.
3. Spawn `compass_planner` and `atlas_early` in parallel.
4. Synthesize the result into a unified implementation plan.
5. Save it to `.forgeflow/<project-name>/current-plan.md` when appropriate.

Output should include:
- phases and deliverables
- in-scope / out-of-scope / deferred
- dependencies and coordination risks
- accessibility checklist
- success criteria
