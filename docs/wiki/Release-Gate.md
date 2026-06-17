# Release Gate

Use this before tagging or publishing Forgeflow. It combines repo release checks with a public-safe evaluation summary example so release notes have verifiable evidence without exposing project internals.

## Local Checks

From a clean release checkout:

```bash
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
node scripts/forgeflow/test-render-dogfood-refresh-plan.js
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
node scripts/forgeflow/test-lean-config.js
node scripts/forgeflow/test-lean-rule-builder.js
node scripts/forgeflow/test-lean-activation-hook.js
node scripts/forgeflow/test-rollup-pattern-learnings.js
node scripts/forgeflow/test-render-pattern-review.js
node scripts/forgeflow/test-render-lean-behavior-eval.js
node scripts/forgeflow/test-render-lean-session.js
node scripts/forgeflow/test-render-lean-portability-pack.js
node scripts/forgeflow/test-render-lean-eval-pack.js
node scripts/forgeflow/test-render-lean-adapter-contract.js
node scripts/forgeflow/test-render-lean-adapter-drift.js
node scripts/forgeflow/test-render-lean-adapter-smoke.js
node scripts/forgeflow/test-render-lean-benchmark-runner.js
node scripts/forgeflow/test-render-lean-hook-contract.js
node scripts/forgeflow/test-render-lean-correctness.js
node scripts/forgeflow/test-render-lean-host-adapters.js
node scripts/forgeflow/test-render-lean-host-command-parity.js
node scripts/forgeflow/test-render-lean-host-packages.js
node --test pi-extension/test/*.test.js
node scripts/forgeflow/test-render-lean-robustness-eval.js
node scripts/forgeflow/test-render-lean-rule-canary.js
node scripts/forgeflow/test-rollup-pilot-evidence.js
node scripts/forgeflow/test-rollup-project-learnings.js
node scripts/forgeflow/test-show-project-learnings.js
node scripts/forgeflow/test-render-project-decision-brief.js
node scripts/forgeflow/test-show-project-trends.js
node scripts/forgeflow/test-show-project-health-timeline.js
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
node scripts/forgeflow/test-build-context-pack.js
node scripts/forgeflow/test-check-context-contract.js
node scripts/forgeflow/test-implementation-notes.js
node scripts/forgeflow/test-check-implementation-notes.js
node scripts/forgeflow/test-check-project-learnings.js
git diff --check
```

From Claude Code, the same release gate is:

```text
/forgeflow-release-check
```

For a grouped, non-mutating readiness view that also runs the release-to-install source preflight, use:

```text
/forgeflow-release-readiness
```

## Public Summary Example

Use the sample fixture to prove the public-summary path renders before release:

```bash
node scripts/forgeflow/render-evaluation-report.js \
  --outcomes fixtures/evaluation/sample-outcomes.jsonl \
  --public \
  --out /tmp/forgeflow-public-evaluation-summary.md
```

Then inspect the shareable output:

```bash
sed -n '1,180p' /tmp/forgeflow-public-evaluation-summary.md
```

Pass criteria:

- The output title is `Forgeflow Evaluation Summary`.
- The summary uses aggregate rates and counts.
- The summary does not include source snippets, private branch names, or reviewer notes with code references.
- The release notes can cite the command that generated the summary.

## Release Notes Evidence

Keep this evidence with the release draft:

```text
release_tag:
release_checks: pass | fail
public_summary_example: pass | fail
clean_checkout_verification: pass | warn | fail
manual_settings_deferrals:
restart_requirements_verified: yes | no
rollback_path_verified: yes | no
known_deferrals:
```

If the release-note draft includes issue context, verify each issue's state before publishing any "fixed" or "closed" claim. Issue references from commit subjects and curated metadata are advisory context, not proof of closure.
Curated issue metadata for release notes must come from a repo-relative local JSON object with a top-level `issues` array. Include only public-safe `number`, `title`, `status`, and `evidence` fields. The release-note helper does not call GitHub.

After publishing, run `/forgeflow-release-verify --save` for the compact shareable post-publish summary plus installed-version/runtime-drift consumability evidence, or `/forgeflow-release-readiness --post-publish --save-post-publish` for the full evidence block. After updating an installed runtime, run `/forgeflow-post-release-install-verify` for a read-only after-update verdict across release verify, runtime drift, and downstream smoke. Future runs can add `/forgeflow-release-verify --compare-last` or `--compare-post-publish-last` on release readiness to compare against the saved snapshot. These checks are advisory and do not tag, push, publish, call GitHub, or mutate installed files.

Do not tag or publish if release checks fail. Treat public-summary failures as release blockers when release notes rely on evaluation evidence. Use [Settings And Recovery](Settings-And-Recovery) to record any manual settings, restart, repair, or rollback deferrals.
