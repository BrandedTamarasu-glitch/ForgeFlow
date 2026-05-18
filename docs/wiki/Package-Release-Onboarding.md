# Package And Release Onboarding

Use this when you arrive at Forgeflow from a package listing, release page, marketplace entry, or shared install link. The goal is to get from first install to a verified first review without needing prior project context.

## Choose Your Entry Point

| You are using | Start here | What it installs |
|---|---|---|
| Claude Code | `/update-forgeflow` | Claude agents, commands, hooks, templates, project rules, patterns, and runtime helpers |
| Codex | `install-template.js --target codex` | Codex agents, skills, and Forgeflow command metadata |
| Both | `install-template.js --target both` | Claude Code and Codex files from one local checkout |

For a clean release verification pass, use [Clean Checkout Install Verification](Clean-Checkout-Install-Verification).

## Claude Code First Run

From Claude Code:

```text
/update-forgeflow
```

Restart Claude Code after the installer finishes. Then verify:

```text
/forgeflow-version
/forgeflow-health
```

If `/forgeflow-health` reports a manual settings issue, edit `~/.claude/settings.json` and rerun the health check. Forgeflow intentionally does not auto-edit `settings.json`. See [Settings And Recovery](Settings-And-Recovery) for statusline, hook, restart, repair, and rollback guidance.

The installed runtime helpers live at:

```text
~/.claude/forgeflow/scripts/forgeflow/
```

## Codex First Run

From a Forgeflow checkout:

```bash
node scripts/forgeflow/install-template.js --target codex --dry-run --json
node scripts/forgeflow/install-template.js --target codex
```

Restart Codex so the new agents and skills are discovered.

Use the Forgeflow review skill:

```text
$forge-review review the current changes
```

Use `$forge-review` instead of `/review` in Codex because `/review` is a Codex built-in command.

## First Useful Review

Pick a real branch with a small to medium change. Run:

```text
/review
```

In Codex, run:

```text
$forge-review review the current changes
```

Pass criteria:

- Forgeflow explains its routing decision.
- Findings include file references and evidence.
- High-risk findings are specific enough to verify.
- Local `.forgeflow/` state is created or repaired only inside the target repo.

## Where To Go Next

- [Quick Start](Quick-Start) for the normal install and workflow path.
- [Codex First Run](Codex-First-Run) for Codex-specific discovery checks.
- [Workflow Commands](Workflow-Commands) for the full command list.
- [Public-Safe Examples](Public-Examples) for example install, health, review, and evaluation output.
- [Migration Guide](Migration-Guide) for existing Claude installs.
- [Settings And Recovery](Settings-And-Recovery) for manual settings, restarts, repair, and rollback.
