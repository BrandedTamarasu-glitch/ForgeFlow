---
name: ship
description: Final Forgeflow shipping workflow for presentation generation, PR preparation, CI monitoring, and failure follow-up.
---

At workflow entry, run `node <helper-dir>/open-session-dashboard.js --root <project-root> --workflow ship` when available. Resolve `<helper-dir>` from the checkout's `scripts/forgeflow` first, then `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. The helper starts or reuses agent-chat and reports known workflow phases on each entry; it uses `CODEX_THREAD_ID`, `CLAUDE_SESSION_ID`, or `FORGEFLOW_SESSION_ID` to open the local dashboard once per session. If the host supplies a session id separately, pass `--session <host-session-id>`; never invent a new id per invocation. Headless runs and `FORGEFLOW_DASHBOARD_AUTO_OPEN=off` skip the launch. A missing helper or unavailable browser must not block the workflow. Report actual phase transitions, significant progress, waiting, and the final result with `node <runtime-root>/services/agent-chat/client.js activity <state> "<short label>"` (`<runtime-root>` is the checkout or installed `forgeflow` directory). Use `complete` only when work and required checks have finished; report `failed` for failures, and never invent progress to keep Ember moving.


Use this skill when the user explicitly wants to ship the branch.

Resolve the user's shipping intent and repository instructions before remote steps. If GitHub is reserved for releases or hosted jobs are disabled, prepare the presentation and validation evidence locally, skip PR creation and CI monitoring/fixes, and publish only the explicitly authorized release. Do not enable hosted jobs or request model credentials to satisfy a skipped CI step. A local shipping handoff does not authorize remote publication.

Resolve helpers before running them: set `FORGEFLOW_HELPER_DIR` to `scripts/forgeflow` when that directory exists, otherwise to `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. A missing helper means the Codex runtime installation needs repair; it does not mean shipping is unsupported in Codex.

Start by running:

```bash
"$FORGEFLOW_HELPER_DIR/ensure-forgeflow-state.sh"
"$FORGEFLOW_HELPER_DIR/ship-prepare.sh" --task "<selected task id>" "<optional title>"
```

`ship-prepare.sh` creates:
- `.forgeflow/<project-name>/ship/ship-summary.json`
- `.forgeflow/<project-name>/ship/ship-presentation.html`
- `.forgeflow/<project-name>/ship/pr-body.md`

Select the task matching the user's current objective; never select by recency alone. The helper uses the task store to verify source and artifact freshness and includes only each criterion's latest evidence. It separates automated tests, manual checks, and review evidence, while showing failed, stale, missing, waived, and pending outcomes. Legacy work may omit `--task`, but then validation stays missing. Unknown tasks fail with a corrective message. Historical project notes are references only; curate relevant decisions and follow-ups into the final artifacts using current evidence. Verify explicit reviewer verdicts separately: task readiness is not review approval, and the generated review gate stays `unknown` until that verification.

Workflow:
1. Verify recent review state and confirm the branch is ready to ship.
2. Gather summary context from git history, changed files, and `.forgeflow/` artifacts.
3. Review and refine the generated ship artifacts instead of rebuilding them from scratch.
4. If asked and approvals allow it, create or update the PR with:

```bash
scripts/forgeflow/ship-open-pr.sh "<title>" ".forgeflow/<project-name>/ship/pr-body.md" "<base-branch>"
```

5. If asked and approvals allow it, check CI status with:

```bash
scripts/forgeflow/ship-ci-status.sh
scripts/forgeflow/ship-ci-status.sh --watch
```

6. If CI fails and the user wants fixes, route the failure to the most relevant implementer(s).

Rules:
- Do not push, create PRs, or mutate remote state without the required approvals.
- Treat review gating as real, not ceremonial.
- Keep presentation content accurate and tightly grounded in the actual diff.
- Prefer updating the generated artifacts instead of discarding them.


## Change reflection

When refining the generated ship artifacts, answer the questions below using the current diff, implementation notes, and review evidence. Reuse current answers and correct stale claims. Include a concise Change reflection section in pr-body.md for both PR creation and updates, avoiding duplicate validation prose.

1. **Is this the simplest change that solves the problem?** Explain the chosen approach and any smaller alternative considered.
2. **Is the complexity proportional to this project's scale and risk?** Use known users, operations, and maintenance needs; state assumptions when unknown. A 100-user internal app is an example, not a default or a reason to drop required safeguards.
3. **One PR = one concern: did anything unrelated sneak in?** State the concern and connect the changed files to it. Flag unrelated work for a separate change.
4. **In your own words, why does this change work?** Explain how the changes produce the intended outcome. For process-only changes, explain the workflow effect.
5. **How did you verify it, and what did you see?** Give actual commands or manual steps, observed results, and untested limits. For documentation or process changes, describe the instruction or command checks performed and why application tests are inapplicable when that is the case.

6. **Does this resolve the issue long-term, or is it a band-aid?** Explain whether the underlying cause is addressed. A temporary workaround is viable, but the PR must explain its limitations and the long-term solution, link an associated GitHub issue, and state the agreed timeline. If the issue or timeline is missing, report the gap explicitly; never invent an issue link or commitment.
7. **Were bugs found outside this PR's scope?** Capture each discovered bug as a follow-up with evidence or reproduction steps, user impact, and an existing issue link or a local tracking entry awaiting filing. Keep unrelated fixes in separate work; do not discard bugs because they are out of scope.
8. **How does this change affect users, and is training needed?** Describe the affected users and workflow changes. Identify required documentation, onboarding, release notes, or training and their readiness, or explain why none is needed.
9. **Do user-facing errors explain what happened and what to do next?** Check changed failure paths for clear, accurate messages and actionable recovery steps without exposing sensitive details. Cite observed behavior and untested paths, or state why this is not applicable.

Reuse existing issues where possible. Create or update GitHub issues only within current remote-write authorization. Otherwise save an actionable issue draft in local implementation notes and surface the pending filing and timeline decisions in the handoff and PR assessment; a draft does not satisfy the associated GitHub issue requirement. Missing follow-up details remain visible without introducing an automatic approval pause.

Keep answers brief and specific to the current diff. AI collaboration alone is not verification evidence. Label agent-written answers as an agent assessment; never imply a human inspected, understood, or approved the change without their input. These prompts guide reflection and do not add hooks, hard gates, or mandatory confirmation pauses.

## Task evidence continuity

Use the shared task workflow for a bounded change with an accepted objective or brief. Resolve `task.js` from the same runtime helper directory used above. Run `list --root <project-root>` and reuse only the task explicitly selected by the user or matching the current objective and scope. Do not attach an unrelated task based only on recency. If this is a new accepted change, create a task using its objective and behavioral acceptance criteria; the task workflow describes the JSON contract.

Keep the same task id across consult, implement, review and ship. Use `check` for actual validation commands and saved `evidence` for observed manual/reviewer results. Record a `checkpoint` at each completed phase and before interruption, including the actual host/session identity when available. A saved plan, successful build, or reviewer verdict alone must not mark every criterion verified. Waivers require explicit user intent and a reason.

Before reporting completion or preparing a shipping handoff, read `status --root <project-root> --task <id>`. Stale/missing/failed criteria and pending actions remain visible. Reconcile interrupted actions from actual evidence, then use `resume`; never silently replay unknown work. Legacy work without task records stays supported but has no source-bound task completion claim. All remote authorization rules above still apply.

## Writing for CLI output

Apply George Orwell's six rules to progress updates, agent reports, and final summaries:

1. Never use a metaphor, simile, or other figure of speech which you are used to seeing in print.
2. Never use a long word where a short one will do.
3. If it is possible to cut a word out, always cut it out.
4. Never use the passive where you can use the active.
5. Never use a foreign phrase, a scientific word, or a jargon word if you can think of an everyday English equivalent.
6. Break any of these rules sooner than say anything outright barbarous.

Lead with the result or action. Use short paragraphs or bullets that scan well in a terminal. Cut stock phrases, repeated summaries, and persona banter. These rules take precedence over persona style and sample prose.

Keep facts, uncertainty, risks, and required evidence intact. Preserve exact commands, code, paths, identifiers, error text, schema keys, and verdict labels. Keep required report sections and machine-readable formats; apply the rules to prose within them. Use a technical term when it is the clearest accurate choice, and explain it when needed. Before sending, cut words that add no meaning without making the result unclear or unnatural.
