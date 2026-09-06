# Support Triage

Shell examples run from the target project root. For `scripts/forgeflow/` commands, use the helper path from your ForgeFlow checkout, or replace that prefix with `"${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow/"` for Codex and `"$HOME/.claude/forgeflow/scripts/forgeflow/"` for Claude Code. Run JavaScript helpers with `node` and shell helpers with `bash`. Replace `<project>` with the actual project folder name before running a placeholder example.

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
support_bundle_redaction_preview: clear | review-needed | not-run
private_data_removed: yes | no
```

Do not ask for raw `.forgeflow/` state, full `settings.json`, secrets, private URLs, customer names, or source snippets unless the project explicitly approves sharing them.

## Triage Matrix

| Symptom | First Check | Likely Fix Layer |
|---|---|---|
| command missing in Claude Code | restart Claude Code, then run `/forgeflow-health` | settings, install, docs |
| hook or statusline not running | `/forgeflow-health` settings output | settings, health |
| Codex skill missing | restart Codex, then check `$CODEX_HOME/skills/` | codex-discovery, template-installer |
| managed file missing | Claude: `/update-forgeflow --repair`; Codex: rerun the template installer for the same home | install, repair |
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

Use [Settings And Recovery](Settings-And-Recovery.md) when the failure involves `settings.json`, restart requirements, repair, or rollback.

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

## Dashboard And Activity

Use [Dashboard](Dashboard.md) when the workshop does not open or its panels look empty. Check runtime dependencies, the current project, service reachability, browser opt-out/headless settings, and whether real review evidence exists. Optional evidence marked informational is not an install failure. Ember reflects reported activity; a preview pose does not prove agents are running. Capture only sanitized status and error text.

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

Repeated routing or review-quality issues should go through [Friction To Fix](Friction-To-Fix.md).

## Context Issues

Run:

```bash
scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json
scripts/forgeflow/advise-context.js --root .forgeflow --record --json
```

Use [Context Budget Examples](Context-Budget-Examples.md) when packets are over budget or savings are low. Share aggregate context totals, not raw context packets.

## Support Bundle Privacy

`/forgeflow-support` includes a snippet-free redaction preview. The preview reports sensitive categories and counts, such as local paths or private URLs, without printing the matched values. Treat `review-needed` as a reminder to create a public-safe summary before sharing the bundle outside the trusted project/team context.

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

Create a fix when the same category repeats across two trials or one issue blocks first review entirely. Use [Pilot Support Rollup](Pilot-Support-Rollup.md) to compare categories across pilots.
