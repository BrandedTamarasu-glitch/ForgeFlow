# Maintainer Pilot

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

1. Install and verify Forgeflow with [Package And Release Onboarding](Package-Release-Onboarding).
2. Confirm manual settings and restart requirements with [Settings And Recovery](Settings-And-Recovery).
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

## Run The Pilot

From Claude Code:

```text
/review
```

From Codex:

```text
$forge-review review the current changes
```

Record the review outcome after human triage:

```bash
scripts/forgeflow/record-review-outcome.js --summary .forgeflow/$(basename "$PWD")/review-outcomes.jsonl --json
```

If context telemetry is available, generate a public-safe summary:

```bash
scripts/forgeflow/render-evaluation-report.js \
  --outcomes .forgeflow/$(basename "$PWD")/review-outcomes.jsonl \
  --context-root .forgeflow \
  --public \
  --out .forgeflow/$(basename "$PWD")/evaluation-summary.md
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
- setup friction is captured in [First-Run Friction](First-Run-Friction) or [Friction To Fix](Friction-To-Fix)

## Stop Criteria

Stop and fix before expanding the trial when:

- settings or restart requirements are unclear after reading the docs
- Forgeflow reports missing managed files after repair
- findings repeatedly lack file evidence
- routing is obviously wrong for the branch risk
- raw local records would need to be shared outside the project to explain the outcome

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
