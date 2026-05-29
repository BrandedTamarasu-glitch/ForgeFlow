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

1. Run `/forgeflow-first-run --runtime claude-code` from Claude Code, or `scripts/forgeflow/render-first-run-guide.js --runtime codex` from a checkout.
2. After the first pass, record the public-safe outcome with `/forgeflow-first-run-result` so setup friction and the continue/fix/defer decision become local evidence. After multiple attempts, run `/forgeflow-first-run-rollup` for aggregate friction trends.
3. Follow the install verification, project-orientation, project-map evolution, profile-readiness, insight-injection, and bounded-work-item steps.
4. Run `/forgeflow-first-useful-win` after a few evidence records when you need a compact "what helped already" summary.
5. Run `/forgeflow-first-task-report` after the first real work item has a next-work or review outcome.
6. Run `/forgeflow-first-task-adoption-loop` when you need a direct repeat, fix, defer, or expand decision from the early evidence.
7. For a fuller adoption trial, run `/forgeflow-pilot --path new-user --runtime claude-code`, or `scripts/forgeflow/render-pilot-script.js --path new-user --runtime codex`.
8. Keep the first task small enough to judge setup friction, guidance quality, review usefulness, and whether the next task starts with better project context.

Use the default maintainer path when a project owner is running a broader pilot across a real branch. Use the new-user path when the goal is to help one person decide whether Forgeflow is worth adopting.

## Refresh Project Guidance

1. Run `/forgeflow-trends --refresh`.
2. Run `/forgeflow-insight-injection` after context packets exist to see which insight blocks agents will receive.
3. Read the freshness, latest-insights, failure-digest, code-map, project-map evolution, and advisor sections.
4. If the report still recommends a command, run that command before spawning review agents.

Use `/forgeflow-learnings --project --check` when you specifically need to inspect the project-learning quality gate.

## Verify Local Readiness

1. Run `/forgeflow-smoke`.
2. Read the health, trends refresh, report refresh, and code-map checks.
3. Follow the first failing or warning recommendation before starting a review.

Use `/forgeflow-smoke --mode source` from a Forgeflow checkout when you want source-tree release guards instead of downstream project readiness checks.

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

## Ship A Change

1. Confirm review history has an approved final verdict.
2. Run `/ship`.
3. Treat secret-scan failures as hard stops.
4. Use the generated handoff, PR body, implementation-notes check, and project-learning summary as the shipping record.

If implementation notes are missing or stale, refresh or repair them before shipping.

## Prepare A Forgeflow Release

1. Update version metadata and release notes.
2. Run `/forgeflow-release-check`.
3. Run `/forgeflow-release-readiness` to execute the release-check list and the release-to-install source preflight. Add `--save-current` to record the current local snapshot, then use `--compare-last` on a later run to see newly failing, cleared, and category-movement comparison without remembering a JSON path. After publishing, use `/forgeflow-release-verify --save` for the compact shareable local post-publish evidence; add `--github` only when you want read-only GitHub release/tag evidence. Run `/forgeflow-release-follow-through` after update verification to confirm post-publish verify, update verify, and runtime consumability are all accounted for. Use the helper directly with `scripts/forgeflow/render-release-readiness.js --baseline <prior-json>` when you need to compare against a specific prior run.
4. Render the public evaluation summary if release notes cite evaluation evidence.
5. Run `/forgeflow-smoke --mode source` for source-tree release guards when you want a shorter local check.
6. Tag and publish only after release checks pass.

## Quick Symptom Map

| Symptom | Next Command |
|---|---|
| Command missing after install | Restart Claude Code, then `/forgeflow-health` |
| Managed file missing or corrupt | `/update-forgeflow --repair` |
| Need post-update confidence | `/forgeflow-update-verify`, then `/forgeflow-health` |
| First time evaluating Forgeflow | `/forgeflow-first-run`, then `/forgeflow-first-run-result`; after several attempts, `/forgeflow-first-run-rollup` |
| Need early adoption evidence | `/forgeflow-first-useful-win` |
| First real task finished | `/forgeflow-first-task-report` |
| Need an adoption decision | `/forgeflow-first-task-adoption-loop` |
| Latest insights stale | `/forgeflow-trends --refresh` |
| Guidance artifacts stale | `/forgeflow-stale-artifact-plan` |
| Need readiness confidence | `/forgeflow-smoke` |
| Failure output is too noisy | `/forgeflow-failure-digest` |
| Need to capture noisy output first | `/forgeflow-capture-output --mode <mode> --command <cmd>` |
| Validation command failed | `/forgeflow-validation-failure-capture --command "<cmd>"`, then feed the failed output to `/forgeflow-capture-output` |
| Output volume is too high | `/forgeflow-noisy-command` |
| Review context is over budget | `/forgeflow-review-wave-prep --write-wave-files`, then rebuild the first focused packet |
| Need focused validation commands | `/forgeflow-validation-plan` |
| Unsure whether review findings are well structured | `/forgeflow-review-evidence-schema --findings <json>` |
| Unsure whether review findings are auto-fix safe | `/forgeflow-review-auto-classify --findings <json>` |
| Need saved review-auto classification evidence | `/forgeflow-review-auto-evidence --findings <json>` |
| Need current project trends | `/forgeflow-trends --refresh` |
| Need release confidence | `/forgeflow-release-readiness`, then `/forgeflow-release-verify` after publishing, then `/forgeflow-release-follow-through` |
