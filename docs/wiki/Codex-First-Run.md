# Codex First Run

Use this when installing Forgeflow into Codex from a local checkout. The goal is to copy agents and skills into your Codex home without overwriting unrelated local config.

## Install From Checkout

From the Forgeflow repository root:

```bash
node scripts/forgeflow/install-template.js --target codex --dry-run --json
```

Review the destinations. The default home is `${CODEX_HOME:-$HOME/.codex}`; an explicit `--codex-home` overrides it. The default layout includes:

```text
~/.codex/agents/
~/.codex/skills/
~/.codex/forgeflow/agent-canonical-map.json
~/.codex/forgeflow/scripts/forgeflow/
~/.codex/forgeflow/services/
```

Then run the install:

```bash
node scripts/forgeflow/install-template.js --target codex
```

Use a custom Codex home for testing:

```bash
node scripts/forgeflow/install-template.js --target codex --codex-home /tmp/codex-forgeflow
```

For a custom test home, launch Codex with `CODEX_HOME=/tmp/codex-forgeflow codex`; restarting a normal session would inspect a different installation. Follow [Quick Start](Quick-Start.md) for service dependencies and project bootstrap before the first workflow. Agent discovery also depends on the models available to your host account; installation alone does not prove a model can run.

## Restart And Verify

Restart Codex so copied agents and skills are discovered.

Check that the core files exist:

```bash
test -f "${CODEX_HOME:-$HOME/.codex}/agents/smith-reviewer.toml"
test -f "${CODEX_HOME:-$HOME/.codex}/agents/warden-reviewer.toml"
test -f "${CODEX_HOME:-$HOME/.codex}/skills/forge-review/SKILL.md"
test -f "${CODEX_HOME:-$HOME/.codex}/skills/consult/SKILL.md"
test -f "${CODEX_HOME:-$HOME/.codex}/skills/implement/SKILL.md"
```

From a Codex session, verify the skills are available by invoking one directly:

```text
$consult summarize this branch and produce an implementation brief
```

For review, prefer the Forgeflow skill name because `/review` is a Codex built-in:

```text
$forge-review review the current branch
```

## First Workflow

Start with a small branch:

```text
$consult produce an implementation brief for this change
$implement execute the brief
$forge-review review the current changes
$ship prepare the branch
```

For a smaller first test:

```text
$quick inspect this branch and route only the useful Forgeflow agents
```

## Local Config Safety

Do not overwrite your existing Codex config. If you want the sample settings, merge only the values you need from:

```text
.codex/config.toml
```

The current sample config sets:

```toml
[agents]
max_threads = 6
max_depth = 1
```

Those settings support the normal Forgeflow fan-out while keeping orchestration in the parent Codex session.

## Drift Check

Codex agents are compact ports of the canonical Claude prompts. To check for drift from the canonical map:

```bash
node scripts/forgeflow/check-codex-agent-drift.js
```

This is a maintainer check of source prompt parity. Users should update or reinstall from a verified checkout if their managed files drift. Maintainers should review the canonical prompt change, update the matching port, and refresh the map only after confirming the semantic match.

## Troubleshooting

- If an agent reports that its model is unsupported by your account, update the checkout, rerun `node scripts/forgeflow/install-template.js --target codex`, and start a fresh Codex session. All shipped Forgeflow roles now omit `model` and `model_reasoning_effort`, allowing them to inherit the working parent session settings. Check project `.codex/agents/` files too: older project copies or custom overrides can still pin unavailable models. Explicit spawn settings and Codex subagent defaults can also override inheritance. See [the model policy](../../CODEX_MIGRATION.md#codex-agent-model-policy).
- If a skill is missing, rerun `install-template.js --target codex --dry-run --json` and confirm the destination path.
- If an agent is missing, check `${CODEX_HOME:-$HOME/.codex}/agents/` in the same environment used to launch Codex and restart the host.
- If `/review` does not run Forgeflow, use `$forge-review`; `/review` is reserved by Codex.
- If local settings changed unexpectedly, restore your Codex config and reinstall with the template installer. The installer copies Forgeflow agents and skills but does not merge `.codex/config.toml` automatically.
