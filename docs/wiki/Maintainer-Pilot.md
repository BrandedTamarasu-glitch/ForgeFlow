# Maintainer Pilot

Shell examples run from the target project root. For `scripts/forgeflow/` commands, use the helper path from your ForgeFlow checkout, or replace that prefix with `"${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow/"` for Codex and `"$HOME/.claude/forgeflow/scripts/forgeflow/"` for Claude Code. Run JavaScript helpers with `node` and shell helpers with `bash`. Replace `<project>` with the actual project folder name before running a placeholder example.

Use this for the first small-team trial of Forgeflow on a real branch. The maintainer stays in control of what is installed, what is shared, and whether the workflow is ready for a broader team rollout.

## Pilot Scope

Pick one branch that is real but bounded:

- small to medium code change
- one clear owner
- no emergency production fix
- no sensitive customer data in review notes
- enough test surface for a human to judge whether findings are useful

Use one runtime first: Claude Code or Codex. Add the second runtime only after the first pass is understood.

## Before The Review

1. Install and verify Forgeflow with [Package And Release Onboarding](Package-Release-Onboarding.md).
2. Confirm manual settings and restart requirements with [Settings And Recovery](Settings-And-Recovery.md).
3. Run a clean health check:

```text
/forgeflow-health
```

For Codex, confirm the skills are visible after restart:

```text
$consult
$implement
$forge-review
$ship
```

4. Make sure `.forgeflow/` and `.forgeflow-budget.json` are ignored or intentionally local.
5. Tell the branch owner that the pilot is evaluating review quality, friction, and time, not replacing maintainer judgment.
6. Choose a sharing level with [Team Privacy Boundaries](Team-Privacy-Boundaries.md).

## Run The Pilot

Print the short script for the selected runtime:

```bash
scripts/forgeflow/render-pilot-script.js --runtime codex
```

If the user is still deciding whether Forgeflow is a fit, print the adoption pack first:

```bash
scripts/forgeflow/render-adoption-pack.js --runtime codex
```

The adoption pack also summarizes existing local pilot-evidence rollups when they exist, so rerun it after recording evidence to see the current repeat, expand, stop-and-fix, or defer signal plus the recommended action, owner lane, blocker, runnable inspection command, and fix layer when available. The decision explanation includes setup friction, project-intelligence readiness, living project-map status, and agent-feedback signal. It also includes a public-safe aggregate summary and small-team handoff checklist for deciding whether to invite one or two additional maintainers.

From Claude Code:

```text
/forgeflow-adoption --runtime claude-code
```

For a net-new user evaluating Forgeflow on a first real task, render the new-user path instead. This path is state-aware: it checks guided repair, release-readiness preview, project intelligence, living project-map status, project learnings, and agent-feedback signal before asking the user to decide whether Forgeflow should continue.

```bash
scripts/forgeflow/render-pilot-script.js --runtime codex --path new-user
```

From Claude Code:

```text
/forgeflow-pilot --runtime claude-code
```

For the new-user path from Claude Code:

```text
/forgeflow-pilot --runtime claude-code --path new-user
```

Use the generated script as the run order for install verification, baseline smoke, trends, report, code map, one bounded work item, final report, evidence capture, and rollup.

From Claude Code:

```text
/review
```

From Codex:

```text
$forge-review review the current changes
```

First record a real outcome using the JSON example and `--input`/`--out` command in [Branch Trial](Branch-Trial.md). Then summarize the existing records (this command does not append an outcome):

```bash
scripts/forgeflow/record-review-outcome.js --summary ".forgeflow/$(basename "$PWD")/review-outcomes.jsonl" --json
```

Use optional `outcome.learning_signals` only for signals that are not already derivable from the review counts, such as `stale_guidance` or `manual_promotion_candidate`.

Create the local pilot evidence note, replacing example status values with what you actually observed:

```bash
scripts/forgeflow/record-pilot-evidence.js --runtime codex --health-result pass --json
```

If context telemetry is available, generate a public-safe summary:

```bash
scripts/forgeflow/render-evaluation-report.js \
  --outcomes ".forgeflow/$(basename "$PWD")/review-outcomes.jsonl" \
  --context-root .forgeflow \
  --public \
  --out ".forgeflow/$(basename "$PWD")/evaluation-summary.md"
```

## What To Judge

Track these signals:

- Were findings specific, evidenced, and actionable?
- Did Forgeflow explain why it chose its review mode?
- Did high-risk findings need Aegis verification?
- How many findings were confirmed, rejected, or deferred?
- How long did the review take compared with the normal maintainer review?
- Did install, restart, settings, or discovery issues slow the trial?
- Did generated local state stay inside expected local folders?

## Pass Criteria

A maintainer pilot is successful enough to repeat when:

- health and version checks pass after install or update
- the maintainer accepts at least one material finding or validates that skip/thin routing was appropriate
- false positives are low enough that the maintainer would run Forgeflow again
- no private raw records need to be shared to explain the result
- setup friction is captured in [First-Run Friction](First-Run-Friction.md) or [Friction To Fix](Friction-To-Fix.md)
- support issues are classified with [Support Triage](Support-Triage.md)
- expansion is decided with [Team Adoption Criteria](Team-Adoption-Criteria.md)

## Stop Criteria

Stop and fix before expanding the trial when:

- settings or restart requirements are unclear after reading the docs
- Forgeflow reports missing managed files after repair
- findings repeatedly lack file evidence
- routing is obviously wrong for the branch risk
- raw local records would need to be shared outside the project to explain the outcome
- [Team Adoption Criteria](Team-Adoption-Criteria.md) would classify the pilot as `stop-and-fix`

## Pilot Summary

Keep this summary local unless the project explicitly agrees to share it:

```yaml
project_type:
runtime: claude-code | codex
branch_type:
install_path:
health_result: pass | warn | fail
review_mode:
confirmed_findings:
rejected_findings:
review_minutes:
setup_friction:
privacy_notes:
repeat_trial: yes | no
next_fix:
```

For repeatable local evidence capture, use [Pilot Evidence Log](Pilot-Evidence-Log.md).
