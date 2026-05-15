---
name: consult
description: Short alias for the Forgeflow consultation workflow that produces an implementation brief before coding.
---

Delegate to the `forgeflow-consult` workflow.

Use this skill when the user wants Forgeflow consultation before implementation.

Before other work, run:

```bash
scripts/forgeflow/ensure-forgeflow-state.sh
```

Workflow:
1. Build compact local memory context with `scripts/forgeflow/build-memory-context.js` when available, and build a first-pass file ownership map with `scripts/forgeflow/build-scope-manifest.js` when available.
2. Spawn `smith_consultant`, `warden_consultant`, `lumen_consultant`, and `atlas_consultant` in parallel.
3. Synthesize with `arbiter_consultant`.
4. Save the resulting brief to `.forgeflow/<project-name>/current-brief.md` when appropriate.

If both this alias and `forgeflow-consult` are available, treat them as equivalent.
