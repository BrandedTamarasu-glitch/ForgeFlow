# First-Run Friction

Use this during field validation to record friction from first install through first useful review. Keep the log local unless the project explicitly wants to share it.

## What To Track

Record one row per first-run attempt:

```text
date:
project_type: frontend | api | monorepo | docs-config | release-prep | other
runtime: claude-code | codex | both
install_path: update-forgeflow | template-installer | existing-install
install_result: pass | warn | fail
version_status: up-to-date | outdated | offline | unknown
health_status: pass | warn | fail
restart_required: yes | no | unknown
first_review_started: yes | no
time_to_first_review_minutes:
blocked_by:
fix_category: install | health | docs | template-installer | codex-discovery | settings | agent-routing | context-budget | other
notes:
```

Do not include secrets, private URLs, source snippets, raw settings files, or customer names.

## Claude Code Checks

For Claude Code installs, capture:

- `/update-forgeflow` result
- `/forgeflow-version` status
- `/forgeflow-health` status
- whether a restart was needed before commands or hooks were visible
- whether `settings.json` hook or statusline wiring was confusing

Common fix categories:

- `install`: download, permissions, managed files missing
- `health`: health output unclear or missing a real failure
- `settings`: manual hook or statusline wiring confusion
- `docs`: user found the right fix only after searching docs

## Codex Checks

For Codex installs, capture:

- `install-template.js --target codex --dry-run --json` result
- whether files landed under `~/.codex/agents/` and `~/.codex/skills/`
- whether Codex was restarted after install
- whether `$consult`, `$implement`, or `$forge-review` appeared or worked
- whether `/review` confusion occurred because it is a Codex built-in

Common fix categories:

- `template-installer`: copied the wrong file set or unclear destination
- `codex-discovery`: agents or skills copied but not visible after restart
- `docs`: first-run guidance missed a required step
- `agent-routing`: the wrong agents were selected after the workflow started

## Rollup

After several trials, summarize friction by category:

```text
trials:
runtime_counts:
pass_without_help:
needed_restart:
blocked_trials:
top_fix_categories:
repeated_notes:
```

Use repeated categories to drive the next change. For example:

- repeated `settings` issues should become clearer health diagnostics or settings snippets
- repeated `codex-discovery` issues should become stronger Codex verification docs or installer checks
- repeated `context-budget` issues should become better defaults, examples, or advisor recommendations

Use [Friction To Fix](Friction-To-Fix) when a repeated category is ready to become an install, health, docs, routing, context, or template-installer change.

## Sharing

Share only aggregate friction counts by default. If a specific failure needs debugging, sanitize paths, account names, branch names, and settings content before sending it outside the project.
