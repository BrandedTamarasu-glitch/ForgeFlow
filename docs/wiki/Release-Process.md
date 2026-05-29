# Release Process

Use this checklist before tagging or publishing a Forgeflow release. It keeps the Claude plugin manifest, marketplace metadata, changelog, release checks, and installed-version command in sync.

## Version Source

The packaged Forgeflow version lives in two files:

```text
.claude-plugin/plugin.json
.claude-plugin/marketplace.json
```

Both files must use the same semver value. For example, a package version of `4.2.0` can use a changelog file named `docs/changelogs/v4.2.html`; non-zero patch releases should use the full version, such as `docs/changelogs/v4.2.1.html`.

## Before Tagging

1. Choose the next semver version.
2. Update `.claude-plugin/plugin.json`.
3. Update the matching Forgeflow entry in `.claude-plugin/marketplace.json`.
4. Add or update the release notes under `docs/changelogs/`.
5. If the latest packaged changelog changed, update the Release Notes link in `docs/index.html`.
6. Confirm the marketplace entry description still names both Claude Code and Codex.
7. Confirm the README current status still reflects the active distribution-readiness work.
8. Run `/forgeflow-release-check` from Claude Code.
9. Render the public summary example with `render-evaluation-report.js --public`, or follow [Release Gate](Release-Gate).
10. Fix any failed check before tagging.

## Command-Line Checks

When running from a checkout instead of Claude Code, run the same release checks from the repository root:

```bash
node scripts/forgeflow/test-command-coverage.js
node scripts/forgeflow/test-command-wrapper-smoke.js
node scripts/forgeflow/test-command-argument-safety.js
node scripts/forgeflow/test-doc-links.js
node scripts/forgeflow/test-doc-drift-report.js
node scripts/forgeflow/test-artifact-contracts.js
node scripts/forgeflow/test-plugin-manifest.js
node scripts/forgeflow/test-release-version.js
node scripts/forgeflow/test-install-template.js
node scripts/forgeflow/test-install-manifest.js
node scripts/forgeflow/test-runtime-helper-contract.js
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
node scripts/forgeflow/test-render-release-verify.js
node scripts/forgeflow/test-render-support-bundle.js
node scripts/forgeflow/test-render-evaluation-report.js
node scripts/forgeflow/render-evaluation-report.js --outcomes fixtures/evaluation/sample-outcomes.jsonl --public --out /tmp/forgeflow-public-evaluation-summary.md
node scripts/forgeflow/test-privacy-boundary.js
node scripts/forgeflow/test-render-adoption-pack.js
node scripts/forgeflow/test-render-context-retention.js
node scripts/forgeflow/test-render-first-run-guide.js
node scripts/forgeflow/test-render-first-useful-win.js
node scripts/forgeflow/test-render-insight-injection.js
node scripts/forgeflow/test-record-first-run-result.js
node scripts/forgeflow/test-rollup-first-run-results.js
node scripts/forgeflow/test-seed-budget-config.js
node scripts/forgeflow/test-record-pilot-evidence.js
node scripts/forgeflow/test-record-agent-feedback.js
node scripts/forgeflow/test-rollup-agent-feedback.js
node scripts/forgeflow/test-record-project-learning.js
node scripts/forgeflow/test-record-next-work-outcome.js
node scripts/forgeflow/test-show-learning-status.js
node scripts/forgeflow/test-user-profile.js
node scripts/forgeflow/test-profile-review.js
node scripts/forgeflow/test-profile-compliance.js
node scripts/forgeflow/test-next-action-contract.js
node scripts/forgeflow/test-classify-review-auto.js
node scripts/forgeflow/test-rollup-pattern-learnings.js
node scripts/forgeflow/test-render-pattern-review.js
node scripts/forgeflow/test-rollup-pilot-evidence.js
node scripts/forgeflow/test-rollup-project-learnings.js
node scripts/forgeflow/test-show-project-learnings.js
node scripts/forgeflow/test-show-project-trends.js
node scripts/forgeflow/test-show-project-health-timeline.js
node scripts/forgeflow/test-build-project-intelligence.js
node scripts/forgeflow/test-smoke-check.js
node scripts/forgeflow/test-dogfood-self-test.js
node scripts/forgeflow/test-installed-runtime-dogfood.js
node scripts/forgeflow/smoke-check.js --mode source --json
node scripts/forgeflow/test-render-pilot-script.js
node scripts/forgeflow/test-check-context-budget.js
node scripts/forgeflow/test-advise-context.js
node scripts/forgeflow/test-build-code-topology.js
node scripts/forgeflow/test-show-code-map.js
node scripts/forgeflow/test-runtime-drift-snapshot.js
node scripts/forgeflow/test-build-context-pack.js
node scripts/forgeflow/test-check-context-contract.js
node scripts/forgeflow/test-implementation-notes.js
node scripts/forgeflow/test-check-implementation-notes.js
node scripts/forgeflow/test-check-project-learnings.js
git diff --check
```

`test-release-version.js` also guards that `/forgeflow-health`, `/forgeflow-trends`, `/forgeflow-report`, and the README all expose the same `/forgeflow-trends --refresh` stale-guidance next action.
`test-dogfood-self-test.js` and `test-installed-runtime-dogfood.js` are listed directly for isolated failure output; `smoke-check.js --mode source --json` also runs both to verify packaged source-smoke and installed-runtime paths. `render-release-readiness.js` also includes a release-to-install preflight that checks every managed runtime helper source is present, regular, and inside the checkout; syntax, helper contract, update, health, and installed-runtime behavior stay covered by the command list.

Render the public-summary example before release notes claim evaluation evidence:

```bash
node scripts/forgeflow/render-evaluation-report.js --outcomes fixtures/evaluation/sample-outcomes.jsonl --public --out /tmp/forgeflow-public-evaluation-summary.md
```

## Tag And Publish

After the release checks pass:

```bash
git status
git commit
git tag vX.Y.Z
git push
git push origin vX.Y.Z
```

Create the GitHub release from the tag and include the release notes summary. The release body should only claim what changed, why it changed, tests run, and known deferrals.
If the release-note draft lists issue context, verify the GitHub issue state before claiming closure. A commit subject can cite `#123`, but closure requires a release-linked issue comment, a closed issue, or another explicit maintainer decision. Curated metadata can add context, but it is not proof that a commit referenced or fixed an issue.
For richer issue notes without GitHub calls, pass a repo-relative local JSON file to `render-release-notes.js --issues <path>`. The file must be a JSON object with a top-level `issues` array. Only `number`, `title`, `status`, and `evidence` are used, and text is redacted through the public-safe release-note filter. Pass `--evidence <path>` with saved local release-verify JSON when the draft should include substantiated status, tag, and install-consumability evidence.

## Verify

After publishing, run:

```text
/forgeflow-version
/forgeflow-health
/forgeflow-release-verify --save
```

`/forgeflow-version` should show the latest GitHub release and installed commit. `/forgeflow-health` should pass after any required manual `settings.json` hook or statusline wiring. `/forgeflow-release-verify --save` should show local tag, changelog, release-note, source-smoke, update-smoke, installed-runtime dogfood evidence, installed-version/runtime-drift consumability evidence, and a shareable summary, then save a local comparison snapshot. Use `/forgeflow-release-verify --github` only when the session has network access; sandboxed runs may report `network-unavailable`, which is not evidence that the release or tag is missing. Use `/forgeflow-release-readiness --post-publish --save-post-publish` when you need the full readiness evidence block. Forgeflow does not auto-edit `settings.json` by design.
After updating an installed runtime, run `/forgeflow-post-release-install-verify` for the read-only loop across release verification, install consumability, and downstream smoke.
