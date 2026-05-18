# Demos

These short sessions show the expected shape of a working Forgeflow install.

## Install Verification

From Claude Code:

```text
/update-forgeflow
```

Expected result:

```text
Forgeflow updated (<old-sha> -> <new-sha>)

Files synced (N):
  commands/forgeflow-version.md  new -> <hash>
  scripts/forgeflow/forgeflow-version.js  new -> <hash>
```

Restart Claude Code, then run:

```text
/forgeflow-version
/forgeflow-health
```

Expected status:

```text
Status: up-to-date
Installed: <sha>
Upstream main: <sha>
Next Step
No update needed.
```

Health should report installed agents, commands, hooks, runtime helpers, and version status. If you run it outside a git repo, project-local `.forgeflow/` checks are skipped rather than failed.

## First Review

From a git project with local changes:

```text
/review
```

Expected flow:

```text
Review route: thin-mode | full-mode | deep-mode
Agents: Smith, Warden, Lumen, Atlas
Arbiter verdict: APPROVE | CONDITIONAL_APPROVE | REVISE | BLOCK
Compass validation: CONFIRM | CHALLENGE
```

Use `/review HEAD~3..HEAD` to review a commit range, or pass specific paths:

```text
/review src/auth.ts src/db.ts
```

## Context Advisor

From a repo checkout:

```bash
scripts/forgeflow/advise-context.js --root .forgeflow --record --json
```

From a Claude install without a checkout:

```bash
~/.claude/forgeflow/scripts/forgeflow/advise-context.js --root .forgeflow --record --json
```

Expected output includes budget status, recent trend deltas, and recommended trims when context packets are too large or low-savings.

## Repair And Rollback

If a managed Forgeflow file is missing or corrupted:

```text
/update-forgeflow --repair
```

Expected result:

```text
Forgeflow repaired (<sha>)
Files synced (N):
  ...
Rollback snapshot: ~/.claude/forgeflow/backups/previous
```

If the update causes a problem:

```text
/update-forgeflow --rollback
```

Expected result:

```text
Forgeflow rolled back.
Files restored (N):
  ...
Version restored to <old-sha>.
```

Rollback restores only Forgeflow-managed files. It does not touch `settings.json`, custom agents, or unrelated files.

## Release Check

Before tagging a Forgeflow release:

```text
/forgeflow-release-check
```

Equivalent terminal checks:

```bash
node scripts/forgeflow/test-command-coverage.js
node scripts/forgeflow/test-plugin-manifest.js
node scripts/forgeflow/test-install-manifest.js
node scripts/forgeflow/test-install-smoke.js
node scripts/forgeflow/test-update-forgeflow.js
node scripts/forgeflow/test-health-check.js
node scripts/forgeflow/test-forgeflow-version.js
node scripts/forgeflow/test-seed-budget-config.js
node scripts/forgeflow/test-check-context-budget.js
node scripts/forgeflow/test-advise-context.js
git diff --check
```

Expected result:

```text
Forgeflow release checks passed.
```
