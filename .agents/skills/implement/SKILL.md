---
name: implement
description: Short alias for the Forgeflow implementation workflow driven by the current implementation brief.
---

Delegate to the `forgeflow-implement` workflow.

Use this skill when the user wants Forgeflow implementation using the current brief.

Before other work, run:

```bash
scripts/forgeflow/ensure-forgeflow-state.sh
```

Workflow:
1. Load `.forgeflow/<project-name>/current-brief.md` unless another brief is specified.
2. Build compact local memory context with `scripts/forgeflow/build-memory-context.js`, first-pass file ownership packets with `scripts/forgeflow/build-scope-manifest.js`, and context budget warnings with `scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json` when available, then resolve remaining file ownership gaps before edits.
3. Spawn the needed implementers plus `compass_validator`.
4. Finish with `arbiter_implementer` for integration checking.

If both this alias and `forgeflow-implement` are available, treat them as equivalent.
