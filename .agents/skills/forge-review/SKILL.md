---
name: forge-review
description: Short alias for the Forgeflow multi-agent review workflow.
---

Delegate to the `forgeflow-review` workflow.

Use this skill when the user wants Forgeflow review of a diff, branch, or file set.

Workflow:
1. Determine the review scope.
2. Spawn the specialist reviewers in parallel.
3. Synthesize with `arbiter_reviewer`.
4. Final-check with `compass_reviewer`.

If both this alias and `forgeflow-review` are available, treat them as equivalent.
