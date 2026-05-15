---
name: forgeflow-consult
description: Run the Forgeflow consultation workflow to produce an implementation brief before coding.
---

Use this skill when the user wants the Forgeflow team to design the approach before implementation.

Workflow:
1. Build compact local memory context with `scripts/forgeflow/build-memory-context.js` when available.
2. Gather focused context for the requested feature.
3. Prefer existing `CONTEXT.md` files and the compact memory context before reading full `.forgeflow/current-*.md` artifacts.
4. Spawn in parallel:
   - `smith_consultant`
   - `warden_consultant`
   - `lumen_consultant`
   - `atlas_consultant`
5. Wait for their briefs.
6. Spawn `arbiter_consultant` with the task, gathered context, and all four outputs.
7. Save the result to `.forgeflow/<project-name>/current-brief.md` when appropriate.
8. Present the implementation brief with ownership, sequencing, interfaces, and open questions.

Rules:
- Optimize for a brief that implementers can execute without ambiguity.
- If there is an existing Compass plan or research output, treat it as authoritative input unless the user asks to replace it.
- Do not start implementation inside this skill unless the user explicitly asks for it.

Suggested prompts:
- `$forgeflow-consult design the approach for adding OAuth login`
- `$forgeflow-consult use docs/spec.md and produce an implementation brief`
