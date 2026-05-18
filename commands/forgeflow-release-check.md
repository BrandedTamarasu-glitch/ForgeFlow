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
node scripts/forgeflow/test-check-context-budget.js
node scripts/forgeflow/test-advise-context.js
git diff --check
```

## Step 3: Report

If every command passes, report:

```text
Forgeflow release checks passed.
```

If any command fails, stop and report the failed command plus its output. Do not tag or publish until it is fixed.

</process>

<success_criteria>
- [ ] Command coverage test passes
- [ ] Local README/wiki link test passes
- [ ] Plugin manifest test passes
- [ ] Release version drift test passes
- [ ] Template installer test passes
- [ ] Install manifest and install smoke tests pass
- [ ] Update, health, and version helper tests pass
- [ ] Evaluation report smoke test passes
- [ ] Context budget/advisor smoke tests pass
- [ ] `git diff --check` passes
</success_criteria>
