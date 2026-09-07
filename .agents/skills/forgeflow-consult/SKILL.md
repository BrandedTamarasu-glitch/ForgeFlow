---
name: forgeflow-consult
description: Run the Forgeflow consultation workflow to produce an implementation brief before coding.
---

At workflow entry, run `node <helper-dir>/open-session-dashboard.js --root <project-root> --workflow forgeflow-consult` when available. Resolve `<helper-dir>` from the checkout's `scripts/forgeflow` first, then `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. The helper starts or reuses agent-chat and reports known workflow phases on each entry; it uses `CODEX_THREAD_ID`, `CLAUDE_SESSION_ID`, or `FORGEFLOW_SESSION_ID` to open the local dashboard once per session. If the host supplies a session id separately, pass `--session <host-session-id>`; never invent a new id per invocation. Headless runs and `FORGEFLOW_DASHBOARD_AUTO_OPEN=off` skip the launch. A missing helper or unavailable browser must not block the workflow. Report actual phase transitions, significant progress, waiting, and the final result with `node <runtime-root>/services/agent-chat/client.js activity <state> "<short label>"` (`<runtime-root>` is the checkout or installed `forgeflow` directory). Use `complete` only when work and required checks have finished; report `failed` for failures, and never invent progress to keep Ember moving.


Use this skill when the user wants the Forgeflow team to design the approach before implementation.

Resolve every `scripts/forgeflow/...` helper from the current checkout first, then from `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. A missing helper means the Codex runtime installation needs repair; it does not mean the workflow is unsupported in Codex.

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


## Task evidence continuity

Use the shared task workflow for a bounded change with an accepted objective or brief. Resolve `task.js` from the same runtime helper directory used above. Run `list --root <project-root>` and reuse only the task explicitly selected by the user or matching the current objective and scope. Do not attach an unrelated task based only on recency. If this is a new accepted change, create a task using its objective and behavioral acceptance criteria; the task workflow describes the JSON contract.

Keep the same task id across consult, implement, review and ship. Use `check` for actual validation commands and saved `evidence` for observed manual/reviewer results. Record a `checkpoint` at each completed phase and before interruption, including the actual host/session identity when available. A saved plan, successful build, or reviewer verdict alone must not mark every criterion verified. Waivers require explicit user intent and a reason.

Before reporting completion or preparing a shipping handoff, read `status --root <project-root> --task <id>`. Stale/missing/failed criteria and pending actions remain visible. Reconcile interrupted actions from actual evidence, then use `resume`; never silently replay unknown work. Legacy work without task records stays supported but has no source-bound task completion claim. All remote authorization rules above still apply.
