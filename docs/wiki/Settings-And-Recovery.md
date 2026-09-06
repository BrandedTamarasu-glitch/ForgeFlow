# Settings And Recovery

Shell examples run from the target project root. For `scripts/forgeflow/` commands, use the helper path from your ForgeFlow checkout, or replace that prefix with `"${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow/"` for Codex and `"$HOME/.claude/forgeflow/scripts/forgeflow/"` for Claude Code. Run JavaScript helpers with `node` and shell helpers with `bash`. Replace `<project>` with the actual project folder name before running a placeholder example.

Use this when a new install passes file checks but Claude Code or Codex has not loaded the new commands, hooks, statusline, agents, or skills yet.

## Manual Settings Boundary

Forgeflow never auto-edits `~/.claude/settings.json`. Health checks can report exact hook and statusline fixes, but the user applies them manually.

Statusline command:

```json
"statusLine": {
  "type": "command",
  "command": "node \"$HOME/.claude/hooks/forgeflow-statusline.js\""
}
```

These are individual PostToolUse hook entries, not a complete settings document. Merge them into the host’s existing `hooks.PostToolUse` structure; do not replace unrelated settings. See [Quick Start](Quick-Start.md) and the repository settings example for the full wiring.

PostToolUse hook commands:

```json
{
  "type": "command",
  "command": "node \"$HOME/.claude/hooks/forgeflow-context-monitor.js\""
}
```

```json
{
  "type": "command",
  "command": "node \"$HOME/.claude/hooks/forgeflow-gate.js\""
}
```

```json
{
  "type": "command",
  "command": "node \"$HOME/.claude/hooks/forgeflow-telemetry.js\""
}
```

After editing settings, validate the JSON and restart Claude Code:

```bash
jq empty ~/.claude/settings.json
```

Then run:

```text
/forgeflow-health
```

## Restart Requirements

Restart Claude Code after:

- running `/update-forgeflow`
- changing `~/.claude/settings.json`
- repairing or rolling back managed command, hook, or agent files
- seeing files installed on disk but commands or hooks unavailable in the current session

Restart Codex after:

- running `install-template.js --target codex`
- changing `$CODEX_HOME/agents/`
- changing `$CODEX_HOME/skills/`

If a command, agent, or skill exists on disk but is not visible, restart first, then rerun the relevant health or discovery check.

## Codex Repair

From a verified ForgeFlow checkout, rerun `node scripts/forgeflow/install-template.js --target codex --dry-run --json`, inspect its destinations, then rerun without `--dry-run --json` and restart Codex. Use the same `CODEX_HOME` or `--codex-home` as the original installation. The Claude commands below do not provide a general Codex rollback; retain any manual backup or known-good checkout you need before replacing managed files. See [Quick Start](Quick-Start.md) for service dependencies if the dashboard fails to start.

## Claude Repair

Use repair when managed Forgeflow files are missing or corrupted:

```text
/update-forgeflow --repair
```

Repair reinstalls managed files from upstream and preserves a rollback snapshot before writing. Plain `/update-forgeflow` also runs this repair path automatically when the installed SHA is current but required managed files are missing. Runtime helper discovery accepts any managed non-test helper under `scripts/forgeflow/`, so newly added helpers can be repaired in the same pass instead of requiring a second run after the manifest changes. It does not edit `settings.json`, custom agents, or unrelated local files.

## Rollback

Use rollback when the last update introduced a managed-file problem:

```text
/update-forgeflow --rollback
```

Rollback restores the previous managed-file snapshot from:

```text
~/.claude/forgeflow/backups/previous
```

Rollback restores previous managed file contents and modes, removes managed files that were newly created by the last update, and restores `~/.claude/forgeflow-version` to the snapshot version.

Rollback does not edit:

- `~/.claude/settings.json`
- custom agents such as `~/.claude/agents/custom-*.md`
- non-Forgeflow local files

Restart Claude Code after rollback, then run:

```text
/forgeflow-version
/forgeflow-health
```

## Legacy Statusline Drift

If `/forgeflow-health` reports `gsd-statusline.js`, update `statusLine.command` manually to point at:

```text
node "$HOME/.claude/hooks/forgeflow-statusline.js"
```

Keeping the old GSD hook file is fine as a manual reference. Forgeflow does not manage or delete it.
