# Quick Start

Install ForgeFlow into Claude Code or Codex, then use it inside the application repository you want to improve. For screenshots and a complete walkthrough, use the [visual guide](../user-guide.html) or [PDF](../ForgeFlow-User-Guide.pdf).

## Prerequisites

Use a working host installation, Git, Node.js, npm, and Bash in the same environment. The repository's CI validates Node 24. With WSL, keep the host and runtime paths in the same WSL environment. Check that the models named by the installed agents are available to your account; a file being installed does not prove the host can run its model.

## Clone The Source

```bash
git clone https://github.com/BrandedTamarasu-glitch/ForgeFlow.git
cd ForgeFlow
```

## Install Into Your Host

Run the matching commands from the ForgeFlow checkout.

### Codex

```bash
node scripts/forgeflow/install-template.js --target codex --dry-run --json
node scripts/forgeflow/install-template.js --target codex
```

The installer respects `CODEX_HOME` and preserves unrelated configuration. Restart Codex, then confirm it discovers `$quick` or `$consult`. See [Codex First Run](Codex-First-Run.md) for custom home directories and model troubleshooting.

### Claude Code

```bash
node scripts/forgeflow/install-template.js --target claude --dry-run --json
node scripts/forgeflow/install-template.js --target claude
```

Restart Claude Code. Follow [Settings and Recovery](Settings-And-Recovery.md) to merge hooks and the status line into your existing settings without overwriting unrelated entries. The installer does not perform that settings merge.

Once the Claude commands are installed, `/update-forgeflow` is the normal updater. `--repair` restores managed files; `--rollback` uses a previous updater snapshot when one exists. Those are Claude updater capabilities. For other installer options, including `--target both`, see [Template Installer](Template-Installer.md).

## Set The Runtime Path

Choose the runtime for the host you installed, and keep this shell open for the following steps:

```bash
# Codex:
FF_RUNTIME="${CODEX_HOME:-$HOME/.codex}/forgeflow"

# Or Claude Code:
# FF_RUNTIME="$HOME/.claude/forgeflow"
```

For a custom Claude home, use that directory's `forgeflow` subdirectory.

## Enable The Dashboard

```bash
npm install --prefix "$FF_RUNTIME/services/dashboard" --ignore-scripts
npm install --prefix "$FF_RUNTIME/services/agent-chat" --ignore-scripts
```

On the first eligible ForgeFlow workflow invocation in a desktop session, the workflow helper starts or reuses the services, reports the phase, and opens **http://127.0.0.1:4003/**. Later invocations reuse the session without opening more tabs. Startup never installs dependencies automatically. Headless sessions and `FORGEFLOW_DASHBOARD_AUTO_OPEN=off` skip automatic launch.

[Dashboard and Ember](Dashboard.md) covers manual startup, animation states, empty panels, and stopping the services.

## Open Your Application Project

Replace the example path with the project you want to work on:

```bash
cd /path/to/your-project
git status --short
bash "$FF_RUNTIME/scripts/forgeflow/ensure-forgeflow-state.sh"
node "$FF_RUNTIME/scripts/forgeflow/seed-budget-config.js" --json
node "$FF_RUNTIME/scripts/forgeflow/health-check.js" --json
```

The bootstrap creates local `.forgeflow/<project-name>/` state and git-ignore entries; the budget helper preserves an existing config. Inspect the resulting changes and choose a suitable working branch. If health reports missing project state, inspect its proposed action; `health-check.js --fix --json` repairs supported local-state gaps. Optional profiles, benchmarks, and outcome history can be absent in a new project.

## Run One Small Task

| Step | Claude Code | Codex |
|---|---|---|
| Design a bounded improvement | `/consult` | `$consult` |
| Execute the brief | `/implement` | `$implement` |
| Review the changes | `/review` | `$forge-review` |
| Prepare the handoff | `/ship` | `$ship` |

Add your task after the command. For example: `design a helpful empty state for the task list, reuse the existing Create task action, and include keyboard behavior`. Run each phase separately, inspect its result, and steer the assistant before continuing. Request any commit, push, PR, or deployment explicitly.

Use `$forge-review` in Codex; its built-in `/review` is a different command. The extended Claude catalog is larger than the Codex skill set. [Workflow Commands](Workflow-Commands.md) distinguishes those surfaces.

## Understand The First Results

Ember shows reported activity. Project Readiness identifies actionable checks separately from optional evidence. Review Outcomes and Review Trends need real verdict records; Live Activity needs the activity service and emitted events. Empty panels are explained in [Dashboard](Dashboard.md).

For deeper context, memory, failures, or release work, choose a path in [User Paths](User-Paths.md). [Lean Evidence](Lean-Evidence.md) and [Release Gate](Release-Gate.md) are advanced validation references, not prerequisites for trying a first task.
