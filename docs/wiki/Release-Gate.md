# Release Gate

Use this before tagging or publishing Forgeflow. It combines repo release checks with a public-safe evaluation summary example so release notes have verifiable evidence without exposing project internals.

## Local Checks

From a clean release checkout:

```bash
node scripts/forgeflow/test-command-coverage.js
node scripts/forgeflow/test-doc-links.js
node scripts/forgeflow/test-plugin-manifest.js
node scripts/forgeflow/test-release-version.js
node scripts/forgeflow/test-install-template.js
node scripts/forgeflow/test-install-manifest.js
node scripts/forgeflow/test-runtime-helper-contract.js
node scripts/forgeflow/test-install-smoke.js
node scripts/forgeflow/test-update-forgeflow.js
node scripts/forgeflow/test-health-check.js
node scripts/forgeflow/test-forgeflow-version.js
node scripts/forgeflow/test-guidance-contract.js
node scripts/forgeflow/test-failure-digest.js
node scripts/forgeflow/test-check-agent-drift.js
node scripts/forgeflow/test-render-forgeflow-report.js
node scripts/forgeflow/test-render-evaluation-report.js
node scripts/forgeflow/render-evaluation-report.js --outcomes fixtures/evaluation/sample-outcomes.jsonl --public --out /tmp/forgeflow-public-evaluation-summary.md
node scripts/forgeflow/test-record-pilot-evidence.js
node scripts/forgeflow/test-record-project-learning.js
node scripts/forgeflow/test-rollup-pattern-learnings.js
node scripts/forgeflow/test-rollup-pilot-evidence.js
node scripts/forgeflow/test-rollup-project-learnings.js
node scripts/forgeflow/test-show-project-learnings.js
node scripts/forgeflow/test-show-project-trends.js
node scripts/forgeflow/test-smoke-check.js
node scripts/forgeflow/smoke-check.js --mode source --json
node scripts/forgeflow/test-render-pilot-script.js
node scripts/forgeflow/test-seed-budget-config.js
node scripts/forgeflow/test-check-context-budget.js
node scripts/forgeflow/test-advise-context.js
node scripts/forgeflow/test-build-code-topology.js
node scripts/forgeflow/test-show-code-map.js
node scripts/forgeflow/test-build-context-pack.js
node scripts/forgeflow/test-implementation-notes.js
node scripts/forgeflow/test-check-implementation-notes.js
node scripts/forgeflow/test-check-project-learnings.js
git diff --check
```

From Claude Code, the same release gate is:

```text
/forgeflow-release-check
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

Do not tag or publish if release checks fail. Treat public-summary failures as release blockers when release notes rely on evaluation evidence. Use [Settings And Recovery](Settings-And-Recovery) to record any manual settings, restart, repair, or rollback deferrals.
