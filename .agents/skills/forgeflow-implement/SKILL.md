---
name: forgeflow-implement
description: Run the Forgeflow implementation workflow using an implementation brief, with Compass handling validation and Arbiter checking integration.
---

Use this skill when the user wants Codex to execute work using the Forgeflow structure.

Workflow:
1. Load the implementation brief from `.forgeflow/<project-name>/current-brief.md` unless the user points at another brief.
2. Build compact local memory context with `scripts/forgeflow/build-memory-context.js` when available.
3. If no brief exists, either stop and ask for consultation or run a brief inline consultation if the user explicitly wants that shortcut.
4. Resolve file ownership before edits. No two implementers should own the same file in the same wave.
5. Spawn targeted implementers based on the brief:
   - `smith_implementer`
   - `warden_implementer`
   - `lumen_implementer`
   - `atlas_implementer`
   - `compass_validator`
6. After implementation work finishes, spawn `arbiter_implementer` to check fit, interfaces, and any minimal integration glue.
7. Report what changed, what was validated, and any remaining risks.

Rules:
- Keep each subagent on a disjoint write scope whenever possible.
- Prefer the smallest defensible patch set.
- Compass focuses on tests and validation artifacts, not product code.
- Atlas owns coordination and memory, not implementation churn.

Suggested prompts:
- `$forgeflow-implement execute the current brief`
- `$forgeflow-implement implement the brief in docs/briefs/login.md`
