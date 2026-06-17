# User Paths

Use this page when you know what outcome you want but not which Forgeflow command to start with. The detailed command reference is still [Workflow Commands](Workflow-Commands).

## Install Or Update

1. Run `/update-forgeflow`.
2. Restart Claude Code so new commands and hooks are discovered.
3. Run `/forgeflow-version`. Add `--snapshot` when you want a local support artifact for installed version, helper inventory, and repair guidance.
4. Run `/forgeflow-update-verify`.
5. Run `/forgeflow-health`.

If health reports missing managed files, run `/update-forgeflow --repair`. If the latest update caused a managed-file problem, run `/update-forgeflow --rollback`.

## Try Forgeflow For The First Time

1. Run `/forgeflow-first-run-simulator --runtime claude-code` from Claude Code, or `scripts/forgeflow/render-first-run-simulator.js --runtime codex --json` from a checkout, when you want a read-only first-run preflight.
2. Run `/forgeflow-first-run --runtime claude-code` from Claude Code, or `scripts/forgeflow/render-first-run-guide.js --runtime codex` from a checkout.
3. After the first pass, record the public-safe outcome with `/forgeflow-first-run-result` so setup friction and the continue/fix/defer decision become local evidence. After multiple attempts, run `/forgeflow-first-run-rollup` for aggregate friction trends.
4. Follow the install verification, project-orientation, project-map evolution, profile-readiness, insight-injection, and bounded-work-item steps.
5. Run `/forgeflow-first-useful-win` after a few evidence records when you need a compact "what helped already" summary and the first-use path for install health, profile bootstrap, first task reporting, learning capture, and shareable summary. Add `--runtime codex` for source-helper commands instead of Claude Code slash commands.
6. Run `/forgeflow-first-task-report` after the first real work item has a next-work or review outcome.
7. Run `/forgeflow-first-task-adoption-loop` when you need a direct repeat, fix, defer, or expand decision from the early evidence.
8. For a fuller adoption trial, run `/forgeflow-pilot --path new-user --runtime claude-code`, or `scripts/forgeflow/render-pilot-script.js --path new-user --runtime codex`.
9. Keep the first task small enough to judge setup friction, guidance quality, review usefulness, and whether the next task starts with better project context.

Use the default maintainer path when a project owner is running a broader pilot across a real branch. Use the new-user path when the goal is to help one person decide whether Forgeflow is worth adopting.

## Refresh Project Guidance

1. Run `/forgeflow-trends --refresh`.
2. Run `/forgeflow-insight-injection` after context packets exist to see which insight blocks agents will receive.
3. Read the freshness, latest-insights, failure-digest, code-map, project-map evolution, and advisor sections.
4. If the report still recommends a command, run that command before spawning review agents.

Use `/forgeflow-learnings --project --check` when you specifically need to inspect the project-learning quality gate.
Use `/forgeflow-learning-action` when you want Forgeflow to turn the weakest learning or telemetry source into one concrete capture/check command.

## Verify Local Readiness

1. Run `/forgeflow-smoke`.
2. Read the health, trends refresh, report refresh, and code-map checks.
3. Follow the first failing or warning recommendation before starting a review.

Use `/forgeflow-smoke --mode source` from a Forgeflow checkout when you want source-tree release guards instead of downstream project readiness checks.
Use `/dashboard` when you want the same project-readiness signals in a local UI. The Project Readiness panel reads `GET /api/readiness`, shows status cards and one copy-only next action, and does not run commands or mutate local state.

## Build Project Architecture Intelligence

1. Run `/forgeflow-code-map` to generate static topology, hotspot, import-gap, section, and living-map signals.
2. Run `/forgeflow-project-model` to build the project operating model from topology, learnings, validation, review outcomes, and user profile signals.
3. Run `/forgeflow-architecture --write`, `/forgeflow-ownership --write`, and `/forgeflow-invocation-hints --write` when you want local architecture, owner-surface, and runtime-entrypoint artifacts.
4. Run `/forgeflow-dogfood-refresh-plan` if dogfood evidence is incomplete.
5. Run `/forgeflow-dogfood-report --write` to decide whether the architecture-intelligence path should be kept, refined, or considered for narrow opt-in automation.

## Investigate A Failed Command

1. Keep the raw failing output available.
2. Run `/forgeflow-failure-digest` for test, typecheck, lint, or log output that is safe to summarize.
3. Run `/forgeflow-trends --refresh` so freshness and packet trust can see the latest digest.
4. If the digest says raw output is required, inspect the raw output before relying on any compact summary.

Use `/forgeflow-noisy-command` when the problem is excessive output volume and you need a narrower next invocation.

## Prepare For Review

1. Run `/forgeflow-trends --refresh`.
2. Run `scripts/forgeflow/build-project-intelligence.js --json` when you want one compact review-prep summary before spawning reviewers.
3. Run `/forgeflow-insight-injection` and `/forgeflow-context-contract` when you need to verify packet guidance before agent-heavy work.
4. Run `/review` for Claude Code or `$forge-review` for Codex.
5. If the context advisor reports a budget warning, run `/forgeflow-review-wave-prep --write-wave-files` to get the first focused review-wave command before spawning reviewers.
6. Fix review findings, then rerun review until the final verdict is approved.

Use `/review-auto` only when the fixes are conservative and safe to apply automatically.
Use `/forgeflow-review-evidence-schema --findings <json>` before classification when findings came from manual notes or an external reviewer.
Use `/forgeflow-review-auto-classify --findings <json>` first when you have captured findings and want a read-only safe/risky/blocker preview.
Use `/forgeflow-review-auto-evidence --findings <json>` when you want a saved local classification artifact before applying fixes.

## Keep A Work Item Lean

1. Run `/forgeflow-lean-prime` when you want the shortest first-run checklist for lean mode, decision evidence, report evidence, telemetry quality, and context-injection readiness.
2. Run `/forgeflow-lean-decision --task "<work item>"` before `/consult` when the risk is over-building, adding a dependency too early, or creating an abstraction before reuse has been checked.
3. Optionally run `/forgeflow-lean-mode --profile lite|balanced|strict|ultra --write` to persist a project lean preference, `--profile strict --user --write` for a user-level default, or `--profile off --write` to keep lean guidance explicit-only.
4. Run `/forgeflow-lean-status` when you need to know whether lean guidance is configured, stale, blocked, or eligible for context-pack injection before starting agent-heavy work.
5. Read the reuse candidates, avoid-first list, do-not-simplify boundaries, validation minimum, known ceiling, and upgrade trigger.
6. Continue with `/consult` when the lean decision says the work is current and bounded. The consultation and implementation handoffs carry the compact lean section forward when the helper is available.
7. Run `/forgeflow-lean-review` after implementation when you want a separate over-engineering-only lane before normal review.
8. Use optional `forgeflow: lean: <reason>` or `forgeflow: upgrade when: <trigger>` breadcrumbs only when code or handoff intent would otherwise be unclear.
9. Run `/forgeflow-lean-debt` when you want a ledger of lean shortcuts, known ceilings, and missing upgrade triggers so deferrals stay visible.
10. Run `/forgeflow-lean-audit` when you want repo-wide over-engineering candidates before selecting a cleanup work item.
11. Run `/forgeflow-output-contract --lean-file <path>` on generated lean handoffs or review notes when you want a warning if the writeup is larger than code/result first plus three concise bullets.
12. Run `/forgeflow-lean-report --write` when you want local aggregate evidence about whether lean guidance is helping: diff size, ceiling capture, review/prose warnings, context savings, and telemetry quality. Later context packs can inject compact lean guidance only when lean mode permits it and the lean report plus related quality gates pass.
13. Run `/forgeflow-lean-behavior --file <path>` when you want read-only probes for calibration boundaries, requested explanation preservation, one runnable check, dependency justification, stdlib/native/reuse evidence, and explicit requirement preservation.
14. Run `/forgeflow-lean-session` when you want compact always-on lean guidance for hook or adapter experiments without editing settings.
15. Run `/forgeflow-lean-portability --write` when you want portable lean rule copies under `.forgeflow/<project>/lean-portability/`.
16. Run `/forgeflow-lean-skills` when you want committed skill packages checked against the canonical lean rule text.
17. Run `/forgeflow-lean-eval` when you want a deterministic local fixture check for the lean behavior probes without model calls.
18. Run `/forgeflow-lean-correctness` and `/forgeflow-lean-robustness` when you want deterministic local selftests for "lean but wrong" shortcut traps.
19. Run `/forgeflow-lean-adapter-contract`, `/forgeflow-lean-hook-contract`, `/forgeflow-lean-adapter-smoke`, `/forgeflow-lean-adapter-drift`, and `/forgeflow-lean-rule-canary` before treating lean adapter output as release-ready.
20. Run `/forgeflow-lean-host-adapters`, `/forgeflow-lean-host-command-parity`, and `/forgeflow-lean-pi-smoke` to validate committed adapter artifacts, command-capable host parity, and pi runtime behavior.
21. Run `/forgeflow-lean-host-packages --write` when you want a local manifest describing where each generated adapter belongs.
22. Run `/forgeflow-lean-lab --task-pack <json> --results <json>` when you want to compare baseline, balanced, strict, and ultra guidance modes across repeatable local task results. Treat descriptive output as evidence gathering only until every mode has visible sample size and passing validation.
23. Run `/forgeflow-lean-benchmark-runner --write` to generate an opt-in benchmark scaffold, `/forgeflow-lean-benchmark-results --results <json>` to validate model-backed evidence, then `/forgeflow-lean-benchmark --baseline <json> --current <json>` when you have comparable aggregate baseline and lean-guided metrics.
24. Defer or ask the user when the decision says the task is speculative or lacks a concrete requirement.

## Ship A Change

1. Confirm review history has an approved final verdict.
2. Run `/ship`.
3. Treat secret-scan failures as hard stops.
4. Use the generated handoff, PR body, implementation-notes check, and project-learning summary as the shipping record.

If implementation notes are missing or stale, refresh or repair them before shipping.

## Prepare A Forgeflow Release

1. Update version metadata and release notes.
2. Run `/forgeflow-release-check`.
3. Run `/forgeflow-release-readiness` to execute the release-check list and the release-to-install source preflight. Add `--save-current` to record the current local snapshot, then use `--compare-last` on a later run to see newly failing, cleared, and category-movement comparison without remembering a JSON path. After publishing, use `/forgeflow-release-verify --save` for the compact shareable local post-publish evidence; add `--github` only when you want read-only GitHub release/tag evidence. Run `/forgeflow-release-follow-through` after update verification to confirm post-publish verify, update verify, and runtime consumability are all accounted for. Use `/forgeflow-release-consumption-loop` to see the next update, smoke, or consumption step and whether the loop has a complete or attention badge, then use `/forgeflow-release-consumption` for the final consumed-or-attention rollup; add `--with-smoke` only when you want it to run downstream smoke, and `--save` only when you want a local snapshot. Use the helper directly with `scripts/forgeflow/render-release-readiness.js --baseline <prior-json>` when you need to compare against a specific prior run.
4. Render the public evaluation summary if release notes cite evaluation evidence.
5. Run `/forgeflow-smoke --mode source` for source-tree release guards when you want a shorter local check.
6. Tag and publish only after release checks pass.

## Quick Symptom Map

| Symptom | Next Command |
|---|---|
| Command missing after install | Restart Claude Code, then `/forgeflow-health` |
| Managed file missing or corrupt | `/update-forgeflow --repair` |
| Need post-update confidence | `/forgeflow-update-verify`, then `/forgeflow-health` |
| First time evaluating Forgeflow | `/forgeflow-first-run-simulator`, then `/forgeflow-first-run` and `/forgeflow-first-run-result`; after several attempts, `/forgeflow-first-run-rollup` |
| Need early adoption evidence | `/forgeflow-first-useful-win` |
| First real task finished | `/forgeflow-first-task-report` |
| Need an adoption decision | `/forgeflow-first-task-adoption-loop` |
| Latest insights stale | `/forgeflow-trends --refresh` |
| Weak learning or telemetry source | `/forgeflow-learning-action` |
| Guidance artifacts stale | `/forgeflow-stale-artifact-plan` |
| Need readiness confidence | `/forgeflow-smoke` |
| Want readiness in a UI | `/dashboard`, then inspect the Project Readiness panel |
| Failure output is too noisy | `/forgeflow-failure-digest` |
| Need to capture noisy output first | `/forgeflow-capture-output --mode <mode> --command <cmd>` |
| Validation command failed | `/forgeflow-validation-failure-capture --command "<cmd>"`, then feed the failed output to `/forgeflow-capture-output` |
| Output volume is too high | `/forgeflow-noisy-command` |
| Review context is over budget | `/forgeflow-context-advisor --record`, then `/forgeflow-review-wave-prep --write-wave-files` and rebuild the first focused packet when needed |
| Need focused validation commands | `/forgeflow-validation-plan` |
| Unsure whether review findings are well structured | `/forgeflow-review-evidence-schema --findings <json>` |
| Unsure whether review findings are auto-fix safe | `/forgeflow-review-auto-classify --findings <json>` |
| Need saved review-auto classification evidence | `/forgeflow-review-auto-evidence --findings <json>` |
| Need current project trends | `/forgeflow-trends --refresh` |
| Need architecture or owner-surface guidance | `/forgeflow-code-map`, then `/forgeflow-architecture --write`, `/forgeflow-ownership --write`, and `/forgeflow-invocation-hints --write` |
| Dogfood evidence is incomplete | `/forgeflow-dogfood-refresh-plan` |
| Need release confidence | `/forgeflow-release-readiness`, then `/forgeflow-release-verify` after publishing, then `/forgeflow-release-follow-through`, then `/forgeflow-release-consumption-loop` and `/forgeflow-release-consumption` for the final consumed-or-attention rollup |
