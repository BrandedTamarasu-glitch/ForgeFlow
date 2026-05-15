---
name: forgeflow-implement
description: Run the Forgeflow implementation workflow using an implementation brief, with Compass handling validation and Arbiter checking integration.
---

Use this skill when the user wants Codex to execute work using the Forgeflow structure.

Workflow:
1. Load the implementation brief from `.forgeflow/<project-name>/current-brief.md` unless the user points at another brief.
2. Build compact local memory context with `scripts/forgeflow/build-memory-context.js` and first-pass file ownership packets with `scripts/forgeflow/build-scope-manifest.js` when available.
3. Run `scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json` and `scripts/forgeflow/advise-context.js --root .forgeflow --record --json` when available. Surface budget warnings, trend deltas, and trim recommendations.
4. If no brief exists, either stop and ask for consultation or run a brief inline consultation if the user explicitly wants that shortcut.
5. Resolve remaining file ownership gaps before edits. No two implementers should own the same file in the same wave.
6. Spawn targeted implementers based on the brief:
   - `smith_implementer`
   - `warden_implementer`
   - `lumen_implementer`
   - `atlas_implementer`
   - `compass_validator`
7. After implementation work finishes, spawn `arbiter_implementer` to check fit, interfaces, and any minimal integration glue.
8. Report what changed, what was validated, and any remaining risks.

Rules:
- Keep each subagent on a disjoint write scope whenever possible.
- Prefer the smallest defensible patch set.
- Compass focuses on tests and validation artifacts, not product code.
- Atlas owns coordination and memory, not implementation churn.

Suggested prompts:
- `$forgeflow-implement execute the current brief`
- `$forgeflow-implement implement the brief in docs/briefs/login.md`
