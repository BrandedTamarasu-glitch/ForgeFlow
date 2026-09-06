# Template Installer

Use the local template installer when you want to seed Forgeflow into Claude Code, Codex, or both from a checkout. It is separate from `/update-forgeflow`, which is the normal Claude no-clone updater.

## Install Both Targets

From the Forgeflow repository root:

```bash
node scripts/forgeflow/install-template.js --target both --dry-run --json
node scripts/forgeflow/install-template.js --target both
```

This copies the managed Claude bundle into `~/.claude/` and the Codex bundle into `${CODEX_HOME:-$HOME/.codex}/`. Explicit `--claude-home` and `--codex-home` options override these destinations.

Claude files include agents, commands, hooks, templates, project rules, patterns, and runtime helpers. Codex source files `.codex/agents/*.toml` and `.agents/skills/*` install under the target home’s `agents/` and `skills/` directories. Both hosts also receive runtime helpers, dashboard and activity service files, and managed supporting assets under `forgeflow/`. Codex receives the canonical agent map and runtime inventory there as well.

## Target One Runtime

Claude Code only:

```bash
node scripts/forgeflow/install-template.js --target claude
```

Codex only:

```bash
node scripts/forgeflow/install-template.js --target codex
```

Use custom homes when testing or preparing a portable template:

```bash
node scripts/forgeflow/install-template.js --target both --claude-home /tmp/claude --codex-home /tmp/codex --dry-run --json
```

## Runtime Dependencies

The installer copies managed files; it does not install npm dependencies. Follow [Quick Start](Quick-Start.md) for the dashboard and activity service dependency commands before expecting the workshop to open. Keep Node, npm, and the host in the same shell environment.

## After Installing

Restart the target tool so agents, commands, and skills are reloaded.

For Claude Code, wire `~/.claude/settings.json` manually for hooks and statusline, then run:

```text
/forgeflow-version
/forgeflow-health
```

For Codex, keep existing local config in place. If you need the sample settings, merge the relevant values from `.codex/config.toml` instead of overwriting your current Codex config.

After installing, run `scripts/forgeflow/render-first-run-guide.js --runtime codex` for the compact first-use path. For a complete Codex first-run flow, including dry-run install, restart, skill checks, and drift checks, see [Codex First Run](Codex-First-Run.md).
