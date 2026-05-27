# Template Installer

Use the local template installer when you want to seed Forgeflow into Claude Code, Codex, or both from a checkout. It is separate from `/update-forgeflow`, which is the normal Claude no-clone updater.

## Install Both Targets

From the Forgeflow repository root:

```bash
node scripts/forgeflow/install-template.js --target both
```

This copies the managed Claude bundle into `~/.claude/` and the Codex bundle into `~/.codex/`.

Claude files include agents, commands, hooks, templates, project rules, patterns, and runtime helpers. Codex files include `.codex/agents/*.toml`, `.agents/skills/*`, and the canonical Forgeflow agent map.

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

## After Installing

Restart the target tool so agents, commands, and skills are reloaded.

For Claude Code, wire `~/.claude/settings.json` manually for hooks and statusline, then run:

```text
/forgeflow-version
/forgeflow-health
```

For Codex, keep existing local config in place. If you need the sample settings, merge the relevant values from `.codex/config.toml` instead of overwriting your current Codex config.

After installing, run `scripts/forgeflow/render-first-run-guide.js --runtime codex` for the compact first-use path. For a complete Codex first-run flow, including dry-run install, restart, skill checks, and drift checks, see [Codex First Run](Codex-First-Run).
