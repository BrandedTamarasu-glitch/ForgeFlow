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
node scripts/forgeflow/test-doc-links.js
node scripts/forgeflow/test-plugin-manifest.js
node scripts/forgeflow/test-release-version.js
node scripts/forgeflow/test-install-template.js
node scripts/forgeflow/test-install-manifest.js
node scripts/forgeflow/test-install-smoke.js
node scripts/forgeflow/test-update-forgeflow.js
node scripts/forgeflow/test-health-check.js
node scripts/forgeflow/test-forgeflow-version.js
node scripts/forgeflow/test-render-evaluation-report.js
node scripts/forgeflow/test-seed-budget-config.js
node scripts/forgeflow/test-record-pilot-evidence.js
node scripts/forgeflow/test-record-project-learning.js
node scripts/forgeflow/test-rollup-pilot-evidence.js
node scripts/forgeflow/test-rollup-project-learnings.js
node scripts/forgeflow/test-show-project-learnings.js
node scripts/forgeflow/test-check-context-budget.js
node scripts/forgeflow/test-advise-context.js
node scripts/forgeflow/test-implementation-notes.js
node scripts/forgeflow/test-check-implementation-notes.js
git diff --check
```

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

## Verify

After publishing, run:

```text
/forgeflow-version
/forgeflow-health
```

`/forgeflow-version` should show the latest GitHub release and installed commit. `/forgeflow-health` should pass after any required manual `settings.json` hook or statusline wiring. Forgeflow does not auto-edit `settings.json` by design.
