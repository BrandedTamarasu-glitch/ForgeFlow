# Support Triage

Use this during team trials when a maintainer reports an install, health, routing, context, or review-quality issue. The goal is to classify the issue quickly, collect only safe evidence, and choose the smallest fix layer.

## First Response

Ask for the minimum useful evidence:

```text
runtime: claude-code | codex
install_path: update-forgeflow | template-installer | existing-install
command_that_failed:
expected_result:
actual_result:
health_status: pass | warn | fail | not-run
restart_after_install: yes | no | unknown
private_data_removed: yes | no
```

Do not ask for raw `.forgeflow/` state, full `settings.json`, secrets, private URLs, customer names, or source snippets unless the project explicitly approves sharing them.

## Triage Matrix

| Symptom | First Check | Likely Fix Layer |
|---|---|---|
| command missing in Claude Code | restart Claude Code, then run `/forgeflow-health` | settings, install, docs |
| hook or statusline not running | `/forgeflow-health` settings output | settings, health |
| Codex skill missing | restart Codex, then check `$CODEX_HOME/skills/` | codex-discovery, template-installer |
| managed file missing | `/update-forgeflow --repair` | install, repair |
| review mode obviously wrong | capture route explanation and changed-file shape | agent-routing |
| findings lack file evidence | capture sanitized finding class and reviewer | review-quality |
| context packet too large | run context budget and advisor helpers | context-budget |
| public summary looks too specific | review sharing level and redact | privacy, docs |

## Install And Health

Claude Code:

```text
/forgeflow-version
/forgeflow-health
```

Recovery path:

```text
/update-forgeflow --repair
```

If the last update caused the issue:

```text
/update-forgeflow --rollback
```

Use [Settings And Recovery](Settings-And-Recovery) when the failure involves `settings.json`, restart requirements, repair, or rollback.

## Codex Discovery

From a checkout:

```bash
node scripts/forgeflow/install-template.js --target codex --dry-run --json
node scripts/forgeflow/install-template.js --target codex
```

Then restart Codex and check:

```text
$consult
$implement
$forge-review
$ship
```

If discovery still fails, capture the install path, `$CODEX_HOME`, and whether files exist under agents and skills. Do not share unrelated Codex config.

## Routing And Review Quality

For routing issues, capture:

- review mode selected
- sanitized changed-file categories, such as docs, tests, API, auth, migrations, UI
- which specialist was missing or unnecessary
- whether Aegis should have been used for a high-risk finding

For review-quality issues, capture:

- finding class
- whether the finding had a file reference
- whether the maintainer confirmed, rejected, or deferred it
- whether the issue repeats across more than one branch

Repeated routing or review-quality issues should go through [Friction To Fix](Friction-To-Fix).

## Context Issues

Run:

```bash
scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json
scripts/forgeflow/advise-context.js --root .forgeflow --record --json
```

Use [Context Budget Examples](Context-Budget-Examples) when packets are over budget or savings are low. Share aggregate context totals, not raw context packets.

## Closeout

Classify the support case:

```text
category: install | health | settings | template-installer | codex-discovery | agent-routing | context-budget | review-quality | privacy | docs
blocked_first_review: yes | no
fix_layer:
validation_run:
repeat_issue: yes | no
follow_up:
```

Create a fix when the same category repeats across two trials or one issue blocks first review entirely. Use [Pilot Support Rollup](Pilot-Support-Rollup) to compare categories across pilots.
