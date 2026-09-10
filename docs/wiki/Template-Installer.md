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

## Optional RTK

Forgeflow works without Rust Token Killer. Setup checks both `rtk --version` and `rtk gain`, since another tool shares the RTK name. Missing RTK is optional; an unverified executable gets direct-command fallback guidance. The checks have timeouts and do not include savings-history output in installation reports.

To request installation explicitly:

```bash
node scripts/forgeflow/install-template.js --target codex --install-rtk --dry-run
node scripts/forgeflow/install-template.js --target codex --install-rtk
```

This requires Cargo and a working Rust toolchain. The opt-in runs `cargo install --git https://github.com/rtk-ai/rtk --tag v0.48.0 --locked rtk`, using the official repository and a pinned release. It can download and compile dependencies and writes to the normal Cargo installation directory. Existing verified RTK versions are reused. Default setup and dry runs do not download or install RTK. Other installation methods are in the [upstream guide](https://www.rtk-ai.app/docs/getting-started/installation/).

Forgeflow does not overwrite an unverified RTK executable, run `rtk init`, or modify shell profiles or global hooks. If Cargo's binary directory is outside PATH, setup reports the path to expose. An incomplete explicitly requested RTK setup returns exit 1 with `status: attention`; the Forgeflow files already copied remain installed.

Use RTK for supported commands after verification. Run commands directly when it is unavailable, and use direct execution or `rtk proxy <command>` when raw output is needed for validation or debugging. Do not automatically rerun a failed wrapped write, since it may already have taken effect.

## After Installing

Restart the target tool so agents, commands, and skills are reloaded.

For Claude Code, wire `~/.claude/settings.json` manually for hooks and statusline, then run:

```text
/forgeflow-version
/forgeflow-health
```

For Codex, keep existing local config in place. If you need the sample settings, merge the relevant values from `.codex/config.toml` instead of overwriting your current Codex config.

After installing, run `scripts/forgeflow/render-first-run-guide.js --runtime codex` for the compact first-use path. For a complete Codex first-run flow, including dry-run install, restart, skill checks, and drift checks, see [Codex First Run](Codex-First-Run.md).
