---
name: audit
description: Run a deep Forgeflow audit across the codebase or a focused subsystem for security, systems, schema, and architectural debt.
---

Use this skill when the user wants a deep audit rather than a PR-style review.

Before other work, run:

```bash
scripts/forgeflow/ensure-forgeflow-state.sh
```

Workflow:
1. Determine audit scope from the user request.
2. Gather focused context and representative files for that scope.
3. Spawn `smith_auditor` and `warden_auditor` in parallel.
4. Synthesize with `arbiter_reviewer`.
5. Optionally persist the results into `.forgeflow/<project-name>/` memory files.

Output should include:
- Critical
- High
- Medium
- Low
- Highlights
