---
name: forgeflow-release-check
description: Run the local pre-release validation checklist for Forgeflow command, install, update, health, version, and context helper coverage
argument-hint: ""
allowed-tools:
  - Bash
---
<objective>
Run the local release checklist before tagging or publishing Forgeflow. This command catches broken slash-command frontmatter, install-manifest drift, helper reference drift, and core helper regressions.
</objective>

<process>

## Step 1: Verify repo root

```bash
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
```

If empty, stop:

```text
Run /forgeflow-release-check from inside the Forgeflow repo.
```

## Step 2: Run release checks

Run these commands from `$REPO_ROOT`:

```bash
cd "$REPO_ROOT"
node scripts/forgeflow/test-command-coverage.js
node scripts/forgeflow/test-command-wrapper-smoke.js
node scripts/forgeflow/test-command-wrapper-contract.js
node scripts/forgeflow/test-command-argument-safety.js
node scripts/forgeflow/test-command-args.js
node scripts/forgeflow/test-capture-command-output.js
node scripts/forgeflow/test-doc-links.js
node scripts/forgeflow/test-doc-drift-report.js
node scripts/forgeflow/test-artifact-contracts.js
node scripts/forgeflow/test-plugin-manifest.js
node scripts/forgeflow/test-release-version.js
node scripts/forgeflow/test-install-template.js
node scripts/forgeflow/test-install-manifest.js
node scripts/forgeflow/test-runtime-helper-contract.js
node scripts/forgeflow/test-runtime-inventory.js
node scripts/forgeflow/test-install-smoke.js
node scripts/forgeflow/test-update-forgeflow.js
node scripts/forgeflow/test-health-check.js
node scripts/forgeflow/test-forgeflow-version.js
node scripts/forgeflow/test-render-guided-repair.js
node scripts/forgeflow/test-guidance-contract.js
node scripts/forgeflow/test-failure-digest.js
node scripts/forgeflow/test-check-agent-drift.js
node scripts/forgeflow/test-render-forgeflow-report.js
node scripts/forgeflow/test-render-release-notes.js
node scripts/forgeflow/test-render-post-release-install-verify.js
node scripts/forgeflow/test-render-release-readiness.js
node scripts/forgeflow/test-render-release-follow-through.js
node scripts/forgeflow/test-render-release-consumption-rollup.js
node scripts/forgeflow/test-render-release-consumption-loop.js
node scripts/forgeflow/test-render-release-verify.js
node scripts/forgeflow/test-render-support-bundle.js
node scripts/forgeflow/test-render-evaluation-report.js
node scripts/forgeflow/render-evaluation-report.js --outcomes fixtures/evaluation/sample-outcomes.jsonl --public --out /tmp/forgeflow-public-evaluation-summary.md
node scripts/forgeflow/test-privacy-boundary.js
node scripts/forgeflow/test-render-adoption-pack.js
node scripts/forgeflow/test-render-architecture-docs.js
node scripts/forgeflow/test-render-invocation-hints.js
node scripts/forgeflow/test-render-ownership-map.js
node scripts/forgeflow/test-render-dogfood-report.js
node scripts/forgeflow/test-render-command-index.js
node scripts/forgeflow/test-render-context-retention.js
node scripts/forgeflow/test-render-context-wave-plan.js
node scripts/forgeflow/test-build-context-wave.js
node scripts/forgeflow/test-render-review-wave-prep.js
node scripts/forgeflow/test-render-first-run-guide.js
node scripts/forgeflow/test-render-first-task-report.js
node scripts/forgeflow/test-render-first-task-adoption-loop.js
node scripts/forgeflow/test-render-first-useful-win.js
node scripts/forgeflow/test-render-insight-injection.js
node scripts/forgeflow/test-render-next-work-ranking.js
node scripts/forgeflow/test-render-efficiency-gap-plan.js
node scripts/forgeflow/test-render-outcome-capture-plan.js
node scripts/forgeflow/test-render-workflow-ending-capture.js
node scripts/forgeflow/test-render-learning-capture-nudge.js
node scripts/forgeflow/test-render-command-wrapper-batch.js
node scripts/forgeflow/test-render-wrapper-drift-plan.js
node scripts/forgeflow/test-render-telemetry-quality.js
node scripts/forgeflow/test-record-first-run-result.js
node scripts/forgeflow/test-rollup-first-run-results.js
node scripts/forgeflow/test-record-pilot-evidence.js
node scripts/forgeflow/test-record-agent-feedback.js
node scripts/forgeflow/test-rollup-agent-feedback.js
node scripts/forgeflow/test-record-project-learning.js
node scripts/forgeflow/test-record-next-work-outcome.js
node scripts/forgeflow/test-show-learning-status.js
node scripts/forgeflow/test-user-profile.js
node scripts/forgeflow/test-render-profile-bootstrap.js
node scripts/forgeflow/test-profile-review.js
node scripts/forgeflow/test-profile-compliance.js
node scripts/forgeflow/test-next-action-contract.js
node scripts/forgeflow/test-output-contract.js
node scripts/forgeflow/test-apply-review-autofix-proposal.js
node scripts/forgeflow/test-build-review-autofix-proposal.js
node scripts/forgeflow/test-classify-review-auto.js
node scripts/forgeflow/test-check-review-evidence-schema.js
node scripts/forgeflow/test-render-review-auto-evidence.js
node scripts/forgeflow/test-run-review-autofix-sandbox.js
node scripts/forgeflow/test-show-review-autofix-status.js
node scripts/forgeflow/test-learning-signal-policy.js
node scripts/forgeflow/test-rollup-pattern-learnings.js
node scripts/forgeflow/test-render-pattern-review.js
node scripts/forgeflow/test-rollup-pilot-evidence.js
node scripts/forgeflow/test-rollup-project-learnings.js
node scripts/forgeflow/test-show-project-learnings.js
node scripts/forgeflow/test-render-project-decision-brief.js
node scripts/forgeflow/test-show-project-trends.js
node scripts/forgeflow/test-build-project-intelligence.js
node scripts/forgeflow/test-build-project-operating-model.js
node scripts/forgeflow/test-smoke-check.js
node scripts/forgeflow/test-dogfood-self-test.js
node scripts/forgeflow/test-installed-runtime-dogfood.js
node scripts/forgeflow/smoke-check.js --mode source --json
node scripts/forgeflow/test-render-pilot-script.js
node scripts/forgeflow/test-seed-budget-config.js
node scripts/forgeflow/test-check-context-budget.js
node scripts/forgeflow/test-advise-context.js
node scripts/forgeflow/test-build-code-topology.js
node scripts/forgeflow/test-show-code-map.js
node scripts/forgeflow/test-runtime-drift-snapshot.js
node scripts/forgeflow/test-render-update-verify.js
node scripts/forgeflow/test-render-validation-plan.js
node scripts/forgeflow/test-render-validation-failure-capture.js
node scripts/forgeflow/test-render-stale-artifact-plan.js
node scripts/forgeflow/test-show-project-health-timeline.js
node scripts/forgeflow/test-build-context-pack.js
node scripts/forgeflow/test-check-context-contract.js
node scripts/forgeflow/test-implementation-notes.js
node scripts/forgeflow/test-check-implementation-notes.js
node scripts/forgeflow/test-check-project-learnings.js
git diff --check
```

`test-release-version.js` guards that `/forgeflow-health`, `/forgeflow-trends`, `/forgeflow-report`, and the README all expose `/forgeflow-trends --refresh` as the stale-guidance next action.
`test-dogfood-self-test.js` and `test-installed-runtime-dogfood.js` are listed directly so failures are easy to isolate; `smoke-check.js --mode source --json` also runs both to verify packaged source-smoke and installed-runtime paths.

## Step 3: Report

If every command passes, report:

```text
Forgeflow release checks passed.
```

If any command fails, stop and report the failed command plus its output. Do not tag or publish until it is fixed.

</process>

<success_criteria>
- [ ] Command coverage test passes
- [ ] Command argument safety test passes
- [ ] Local README/wiki link test passes
- [ ] Plugin manifest test passes
- [ ] Release version drift test passes
- [ ] Template installer test passes
- [ ] Install manifest and install smoke tests pass
- [ ] Runtime helper contract matrix test passes
- [ ] Update, health, and version helper tests pass
- [ ] Failure digest compaction and triage tests pass
- [ ] Agent drift helper test passes
- [ ] Forgeflow report helper test passes
- [ ] Evaluation report smoke test and public-summary render pass
- [ ] Adoption pack renderer test passes
- [ ] Pilot evidence recorder test passes
- [ ] Agent feedback recorder test passes
- [ ] Project learning recorder test passes
- [ ] User profile helper test passes
- [ ] Review-auto deterministic proposal builder and apply tests pass
- [ ] Pattern learnings rollup test passes
- [ ] Pilot evidence rollup test passes
- [ ] Project learnings rollup test passes
- [ ] Project learnings display test passes
- [ ] Project trends display test passes
- [ ] Project intelligence rollup test passes
- [ ] Smoke check test passes
- [ ] Dogfood self-test passes
- [ ] Installed-runtime dogfood test passes
- [ ] Source-mode smoke release guards pass
- [ ] Pilot script renderer test passes
- [ ] Context budget/advisor smoke tests pass
- [ ] Code topology helper test passes
- [ ] Project code map display test passes
- [ ] Context pack test passes
- [ ] Implementation notes wiring and quality-check tests pass
- [ ] Project learnings quality-check test passes
- [ ] Review-auto sandbox proposal runner test passes
- [ ] `git diff --check` passes
</success_criteria>
