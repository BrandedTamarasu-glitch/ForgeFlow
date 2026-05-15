---
name: forgeflow-review
description: Run the Forgeflow review workflow by spawning specialist reviewers, then synthesizing with Arbiter and final-checking with Compass.
---

Use this skill when the user wants a multi-agent review of current changes, specific files, or a diff against a git ref.

Before other work, run:

```bash
scripts/forgeflow/ensure-forgeflow-state.sh
```

Workflow:
1. Determine review scope from the user request.
2. Explain the route before spawning agents. Prefer:

```bash
scripts/forgeflow/explain-review-route.js --json
```

   If a calibration summary exists, include it:

```bash
scripts/forgeflow/explain-review-route.js --json --calibration .forgeflow/Forgeflow/calibration-summary.json
```

3. Build a local context pack when the helper exists:

```bash
scripts/forgeflow/build-context-pack.js --json
```

   Pass `--files`, `--lines`, `--mode`, and `--calibration` when those values were already resolved. This also refreshes `.forgeflow/<project>/index/memory-index.json` when local memory exists. Use the generated `agent-packets/<agent>.md` as the primary reviewer context and `synthesis-input.json` for Arbiter/Compass.
4. Run `scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json` and `scripts/forgeflow/advise-context.js --root .forgeflow --record --json` when available. Surface budget warnings, trend deltas, and trim recommendations before spawning reviewers.
5. Read only the files needed for that scope. Prefer exact files or `git diff --name-only`; avoid re-reading files already covered by the context pack unless exact source lines are needed.
6. Spawn reviewer agents in parallel according to the route:
   - `smith_reviewer`
   - `warden_reviewer`
   - `lumen_reviewer`
   - `atlas_reviewer`
7. If the route is thin-mode, you may skip `lumen_reviewer` and `atlas_reviewer`.
8. Before Arbiter synthesis, send high-risk findings through `aegis`:
   - security
   - auth, session, permissions, tenant isolation
   - migration, schema, data loss
   - critical correctness
   - broad refactor regression
   - accessibility blocker
9. Wait for reviewer and verifier outputs, then spawn `arbiter_reviewer` with the collected findings, verifier decisions, routing note, and the file list.
10. Spawn `compass_reviewer` after Arbiter with:
   - Arbiter's verdict
   - reviewer outputs
   - verifier outputs
   - routing note
   - any available plan, research, or discussion notes from `.forgeflow/`
11. Return findings first. Summaries come after findings.

Rules:
- Keep review file-scoped. Do not broaden scope without evidence.
- Review agents should not edit files.
- Persona confidence is not evidence. High-risk claims need neutral verification before becoming blockers.
- Include a routing note in the final response: mode, agents included/skipped, verifier used/skipped, telemetry hints, and why.
- Compass may run targeted tests when that materially improves the review.
- If the user asks for a "review", default to this skill.

Suggested prompts:
- `$forgeflow-review review this branch against main`
- `$forgeflow-review review src/auth.ts and src/routes/session.ts`
