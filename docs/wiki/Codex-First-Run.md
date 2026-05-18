# Codex First Run

Use this when installing Forgeflow into Codex from a local checkout. The goal is to copy agents and skills into your Codex home without overwriting unrelated local config.

## Install From Checkout

From the Forgeflow repository root:

```bash
node scripts/forgeflow/install-template.js --target codex --dry-run --json
```

Review the destinations. The dry run should show files copied into:

```text
~/.codex/agents/
~/.codex/skills/
~/.codex/forgeflow/agent-canonical-map.json
```

Then run the install:

```bash
node scripts/forgeflow/install-template.js --target codex
```

Use a custom Codex home for testing:

```bash
node scripts/forgeflow/install-template.js --target codex --codex-home /tmp/codex-forgeflow
```

## Restart And Verify

Restart Codex so copied agents and skills are discovered.

Check that the core files exist:

```bash
test -f ~/.codex/agents/smith-reviewer.toml
test -f ~/.codex/agents/warden-reviewer.toml
test -f ~/.codex/skills/forge-review/SKILL.md
test -f ~/.codex/skills/consult/SKILL.md
test -f ~/.codex/skills/implement/SKILL.md
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
scripts/forgeflow/check-codex-agent-drift.js
```

If it fails, update the matching `.codex/agents/*.toml` prompt and refresh the affected hash in `.codex/agent-canonical-map.json`.

## Troubleshooting

- If a skill is missing, rerun `install-template.js --target codex --dry-run --json` and confirm the destination path.
- If an agent is missing, check `~/.codex/agents/` and restart Codex.
- If `/review` does not run Forgeflow, use `$forge-review`; `/review` is reserved by Codex.
- If local settings changed unexpectedly, restore your Codex config and reinstall with the template installer. The installer copies Forgeflow agents and skills but does not merge `.codex/config.toml` automatically.
