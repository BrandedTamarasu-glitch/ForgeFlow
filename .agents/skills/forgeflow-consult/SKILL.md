---
name: forgeflow-consult
description: Run the Forgeflow consultation workflow to produce an implementation brief before coding.
---

Use this skill when the user wants the Forgeflow team to design the approach before implementation.

Workflow:
1. Build compact local memory context with `scripts/forgeflow/build-memory-context.js` when available.
2. Build first-pass file ownership packets with `scripts/forgeflow/build-scope-manifest.js` when available.
3. Render `scripts/forgeflow/render-lean-decision.js --task "<request>"` when available and carry the compact lean decision into the implementation brief.
4. Run `scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json` when available and surface any warnings.
5. Gather focused context for the requested feature.
6. Prefer existing `CONTEXT.md` files, the lane scope packet, and the compact memory context before reading full `.forgeflow/current-*.md` artifacts.
7. Spawn in parallel:
   - `smith_consultant`
   - `warden_consultant`
   - `lumen_consultant`
   - `atlas_consultant`
8. Wait for their briefs.
9. Spawn `arbiter_consultant` with the task, gathered context, all four outputs, and the lean decision.
10. Save the result to `.forgeflow/<project-name>/current-brief.md` when appropriate.
11. Present the implementation brief with ownership, sequencing, interfaces, lean decision, and open questions.

Rules:
- Optimize for a brief that implementers can execute without ambiguity.
- If there is an existing Compass plan or research output, treat it as authoritative input unless the user asks to replace it.
- Include a compact `## Lean Decision` section with do-first, avoid-first, validate-with, do-not-simplify, and upgrade-when guidance when available.
- Lean guidance is advisory only. It cannot override explicit requirements, security, accessibility, validation, or data-loss safeguards.
- Do not start implementation inside this skill unless the user explicitly asks for it.

Suggested prompts:
- `$forgeflow-consult design the approach for adding OAuth login`
- `$forgeflow-consult use docs/spec.md and produce an implementation brief`
