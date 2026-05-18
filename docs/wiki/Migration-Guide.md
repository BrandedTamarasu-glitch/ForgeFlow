# Migration Guide

Use this when moving an existing local Claude install to the current Forgeflow layout.

## What The Current Layout Uses

Managed Forgeflow files live under:

```text
~/.claude/agents/
~/.claude/commands/
~/.claude/hooks/
~/.claude/templates/
~/.claude/project-rules/
~/.claude/forgeflow-patterns/
~/.claude/forgeflow/scripts/forgeflow/
```

The installed commit is tracked at:

```text
~/.claude/forgeflow-version
```

Custom agents named `custom-*.md` are preserved by the updater.

## Before Migrating

Check what is installed:

```text
/forgeflow-version
/forgeflow-health
```

If `/forgeflow-version` is unavailable, run from a repo checkout:

```bash
scripts/forgeflow/forgeflow-version.js --offline
```

Optional backup:

```bash
tar -czf ~/forgeflow-claude-backup.tgz \
  ~/.claude/agents \
  ~/.claude/commands \
  ~/.claude/hooks \
  ~/.claude/templates \
  ~/.claude/project-rules \
  ~/.claude/forgeflow-patterns \
  ~/.claude/forgeflow-version 2>/dev/null
```

## Standard Migration

From Claude Code:

```text
/update-forgeflow
```

Restart Claude Code, then run:

```text
/forgeflow-version
/forgeflow-health
```

Expected result:

```text
Status: up-to-date
Summary: 0 failures
```

If commands or hooks are installed on disk but unavailable in the current Claude session, restart Claude Code again.

## Repair A Partial Install

Use repair mode when a managed command, agent, hook, template, pattern, or runtime helper is missing or corrupted:

```text
/update-forgeflow --repair
```

Repair reinstalls all managed Forgeflow files from upstream `main`, even when the installed SHA already matches upstream.

It does not touch:

- `~/.claude/settings.json`
- `~/.claude/agents/custom-*.md`
- non-Forgeflow files

## Roll Back The Previous Update

The script-backed updater preserves one managed-file snapshot before writes:

```text
~/.claude/forgeflow/backups/previous/
```

To restore it:

```text
/update-forgeflow --rollback
```

Rollback restores previous managed file contents and file modes, removes managed files that were newly created by the last update, and restores `~/.claude/forgeflow-version` to the snapshot version.

Rollback does not mutate `settings.json`.

## Settings Wiring

Forgeflow never auto-edits `~/.claude/settings.json`. If `/forgeflow-health` reports hook or statusline drift, edit settings manually.

Statusline:

```json
"statusLine": {
  "type": "command",
  "command": "node \"/home/corye/.claude/hooks/forgeflow-statusline.js\""
}
```

PostToolUse hooks:

```json
{
  "type": "command",
  "command": "node \"/home/corye/.claude/hooks/forgeflow-context-monitor.js\""
}
```

```json
{
  "type": "command",
  "command": "node \"/home/corye/.claude/hooks/forgeflow-gate.js\""
}
```

```json
{
  "type": "command",
  "command": "node \"/home/corye/.claude/hooks/forgeflow-telemetry.js\""
}
```

After settings changes, restart Claude Code and rerun:

```text
/forgeflow-health
```

## If You Previously Used GSD Hooks

`/forgeflow-health` may report a legacy `gsd-statusline.js` statusline. That is not automatically replaced.

To use Forgeflow context monitoring, set `statusLine.command` to:

```text
node "/home/corye/.claude/hooks/forgeflow-statusline.js"
```

Keep the old GSD hook file if you want a manual rollback reference. It is not a Forgeflow-managed file.

## Project-Local State

Run this inside each git project where you want Forgeflow memory:

```bash
~/.claude/forgeflow/scripts/forgeflow/health-check.js --fix --json
```

This creates:

```text
.forgeflow/<project-name>/
.forgeflow/<project-name>/agent-notes/
.forgeflow-budget.json
```

It also adds `.forgeflow/` to `.gitignore` when needed.

## Final Smoke Test

From a git project:

```text
/forgeflow-version
/forgeflow-health
/quick summarize this repository structure
/review
```

For docs-only or empty diffs, `/review` may route to `skip-mode` or `thin-mode`. That is expected.
