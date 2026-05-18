# Clean Checkout Install Verification

Use this before a release or marketplace handoff to prove the documented install paths work without relying on an existing Forgeflow checkout, shell state, or local project files.

## Scope

Verify both supported entry points:

- Claude Code from the no-clone `/update-forgeflow` path.
- Codex from a fresh checkout using the template installer.

Run this from a temporary directory or disposable test user when possible. Do not run it from a project that already has `.forgeflow/` state unless the goal is to test migration behavior.

## Claude Code Verification

Start from a Claude install that does not already contain Forgeflow commands, agents, or hooks. If testing on your normal machine, record any existing `~/.claude/` customizations first.

From Claude Code, install Forgeflow:

```text
/update-forgeflow
```

Restart Claude Code so new commands, agents, hooks, and templates are discovered.

Then run:

```text
/forgeflow-version
/forgeflow-health
```

Pass criteria:

- `/forgeflow-version` reports an installed commit and a reachable helper root.
- `/forgeflow-health` reports agents, commands, project rules, hooks, runtime helpers, and settings JSON status.
- Any remaining manual settings work is explicit, especially `statusLine.command` pointing at `forgeflow-statusline.js`.
- Runtime helpers exist under `~/.claude/forgeflow/scripts/forgeflow/`.

If the project being tested is a git repo, initialize local state:

```bash
~/.claude/forgeflow/scripts/forgeflow/ensure-forgeflow-state.sh
```

Then verify:

```bash
~/.claude/forgeflow/scripts/forgeflow/health-check.js --fix --json
```

## Codex Verification

Use a clean checkout for the tagged release being tested:

```bash
git clone https://github.com/BrandedTamarasu-glitch/ForgeFlow.git forgeflow-install-check
cd forgeflow-install-check
git checkout <release-tag>
```

Preview the install into a disposable Codex home:

```bash
CODEX_HOME=/tmp/forgeflow-codex-home node scripts/forgeflow/install-template.js --target codex --dry-run --json
```

Run the install:

```bash
CODEX_HOME=/tmp/forgeflow-codex-home node scripts/forgeflow/install-template.js --target codex
```

Pass criteria:

- The dry run lists the expected Codex agents and skills without changing files.
- The install writes Forgeflow agents under `$CODEX_HOME/agents/`.
- The install writes Forgeflow skills under `$CODEX_HOME/skills/`.
- The install writes the Forgeflow command map under `$CODEX_HOME/forgeflow/`.
- Codex is restarted before discovery is judged.

After restart, verify that Forgeflow skills are visible in Codex:

```text
$consult
$implement
$forge-review
$ship
```

Use `$forge-review` for Forgeflow review in Codex because `/review` is a Codex built-in command.

## Release Gate

Before tagging or publishing, run the repo checks from the release checkout:

```bash
node scripts/forgeflow/test-doc-links.js
node scripts/forgeflow/test-plugin-manifest.js
node scripts/forgeflow/test-install-template.js
node scripts/forgeflow/test-release-version.js
```

Then run the user-facing release command from Claude Code:

```text
/forgeflow-release-check
```

Do not call the release install path verified if only the repo-local tests pass. At least one Claude Code install path and one Codex install path should be exercised from clean state.

## Record

Capture this summary for release notes or field validation:

```yaml
release_tag:
date:
tester:
claude_update_path: pass | warn | fail
claude_health: pass | warn | fail
codex_template_dry_run: pass | warn | fail
codex_template_install: pass | warn | fail
codex_discovery_after_restart: pass | warn | fail
manual_settings_required:
known_deferrals:
```
