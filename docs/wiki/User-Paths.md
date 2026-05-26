# User Paths

Use this page when you know what outcome you want but not which Forgeflow command to start with. The detailed command reference is still [Workflow Commands](Workflow-Commands).

## Install Or Update

1. Run `/update-forgeflow`.
2. Restart Claude Code so new commands and hooks are discovered.
3. Run `/forgeflow-version`.
4. Run `/forgeflow-health`.

If health reports missing managed files, run `/update-forgeflow --repair`. If the latest update caused a managed-file problem, run `/update-forgeflow --rollback`.

## Try Forgeflow For The First Time

1. Run `/forgeflow-pilot --path new-user --runtime claude-code` from Claude Code, or `scripts/forgeflow/render-pilot-script.js --path new-user --runtime codex` from a checkout.
2. Follow the generated readiness, project-orientation, first-work-item, and decision steps. The new-user path includes guided repair, release-readiness preview, project intelligence, living project-map status, and agent-feedback signal checks.
3. Keep the first task small enough to judge setup friction, guidance quality, review usefulness, and whether the next task starts with better project context.

Use the default maintainer path when a project owner is running a broader pilot across a real branch. Use the new-user path when the goal is to help one person decide whether Forgeflow is worth adopting.

## Refresh Project Guidance

1. Run `/forgeflow-trends --refresh`.
2. Read the freshness, latest-insights, failure-digest, code-map, and advisor sections.
3. If the report still recommends a command, run that command before spawning review agents.

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
3. Run `/review` for Claude Code or `$forge-review` for Codex.
4. If the context advisor reports a budget warning, split the file scope before spawning reviewers.
5. Fix review findings, then rerun review until the final verdict is approved.

Use `/review-auto` only when the fixes are conservative and safe to apply automatically.

## Ship A Change

1. Confirm review history has an approved final verdict.
2. Run `/ship`.
3. Treat secret-scan failures as hard stops.
4. Use the generated handoff, PR body, implementation-notes check, and project-learning summary as the shipping record.

If implementation notes are missing or stale, refresh or repair them before shipping.

## Prepare A Forgeflow Release

1. Update version metadata and release notes.
2. Run `/forgeflow-release-check`.
3. Run `/forgeflow-release-readiness` to execute the release-check list and the release-to-install source preflight. Use the helper directly with `scripts/forgeflow/render-release-readiness.js --baseline <prior-json>` when you need newly failing, cleared, and category-movement comparison against a prior run.
4. Render the public evaluation summary if release notes cite evaluation evidence.
5. Run `/forgeflow-smoke --mode source` for source-tree release guards when you want a shorter local check.
6. Tag and publish only after release checks pass.

## Quick Symptom Map

| Symptom | Next Command |
|---|---|
| Command missing after install | Restart Claude Code, then `/forgeflow-health` |
| Managed file missing or corrupt | `/update-forgeflow --repair` |
| First time evaluating Forgeflow | `/forgeflow-pilot --path new-user` |
| Latest insights stale | `/forgeflow-trends --refresh` |
| Need readiness confidence | `/forgeflow-smoke` |
| Failure output is too noisy | `/forgeflow-failure-digest` |
| Output volume is too high | `/forgeflow-noisy-command` |
| Review context is over budget | Split scope, then rerun review prep |
| Need current project trends | `/forgeflow-trends --refresh` |
| Need release confidence | `/forgeflow-release-readiness` |
