# Pilot Evidence Log

Shell examples run from the target project root. For `scripts/forgeflow/` commands, use the helper path from your ForgeFlow checkout, or replace that prefix with `"${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow/"` for Codex and `"$HOME/.claude/forgeflow/scripts/forgeflow/"` for Claude Code. Run JavaScript helpers with `node` and shell helpers with `bash`. Replace `<project>` with the actual project folder name before running a placeholder example.

Use this after a maintainer pilot to capture local evidence from one real branch. Keep the log local unless the project explicitly approves sharing it.

## Create The Local Folder

Store pilot notes under the ignored Forgeflow state folder:

```bash
PROJECT="$(basename "$PWD")"
mkdir -p ".forgeflow/${PROJECT}/pilot-evidence"
```

## Capture Template

Create one note per pilot:

```yaml
pilot_id:
date:
maintainer:
runtime: claude-code | codex
project_type: frontend | api | monorepo | docs-config | release-prep | other
branch_shape:
install_path: update-forgeflow | template-installer | existing-install
health_result: pass | warn | fail
version_result: up-to-date | outdated | offline | unknown
sharing_level: local-maintainer | private-team | public
review_mode:
confirmed_findings:
rejected_findings:
deferred_findings:
review_minutes:
setup_friction:
support_categories:
context_budget_status:
project_intelligence_readiness: ready | needs-refresh | needs-triage | blocked | unknown
living_project_map_status: useful | missing | unclear | not-useful | unknown
agent_feedback_signal: positive | unclear | negative | incorrect | missing | unknown
public_summary_generated: yes | no
adoption_decision: repeat-pilot | expand-small-team | stop-and-fix | defer
next_action:
```

## Minimum Evidence

Attach or reference only local-safe artifacts:

- `/forgeflow-health` status, summarized as pass, warn, or fail
- selected review mode
- human triage counts
- support categories from [Support Triage](Support-Triage.md)
- sharing level from [Team Privacy Boundaries](Team-Privacy-Boundaries.md)
- adoption decision from [Team Adoption Criteria](Team-Adoption-Criteria.md)
- project-intelligence readiness, living project-map status, and agent-feedback signal when available

Do not paste raw `settings.json`, source snippets, full reviewer comments, secrets, customer names, private URLs, or raw `.forgeflow/` artifacts into a shareable note.

## Commands

Create a local pilot evidence note, replacing example status values with what you actually observed:

```bash
scripts/forgeflow/record-pilot-evidence.js \
  --runtime codex \
  --project-type docs-config \
  --health-result pass \
  --adoption-decision repeat-pilot \
  --next-action "Run one more bounded branch" \
  --json
```

The recorder rejects obvious secret assignments, private key headers, long token-like values, private/internal URLs, and scp-style internal repo URLs before writing the note.

State-aware fields are normalized before writing. For example, `needs_refresh` becomes `needs-refresh`, `not useful` becomes `not-useful`, and corrective agent feedback becomes `incorrect`.

After writing a note, the recorder refreshes `.forgeflow/<project-name>/pilot-evidence-rollup.md` unless `--no-rollup` is passed.

The rollup explains repeat, expand, stop-and-fix, or defer decisions using setup friction, project-intelligence readiness, living project-map status, and agent-feedback signal. These are aggregate local signals only; keep raw notes private unless the project explicitly approves sharing.

First record a real outcome using the JSON example and `--input`/`--out` command in [Branch Trial](Branch-Trial.md). Then summarize the existing records (this command does not append an outcome):

```bash
scripts/forgeflow/record-review-outcome.js \
  --summary ".forgeflow/$(basename "$PWD")/review-outcomes.jsonl" \
  --json
```

Outcome records can include optional `outcome.learning_signals` counts for `stale_guidance` and `manual_promotion_candidate`. Confirmed findings, rejected findings, and post-merge regressions are also rolled into true-positive, false-positive, and missed-issue learning signals automatically.

If sharing rules allow a public summary:

```bash
scripts/forgeflow/render-evaluation-report.js \
  --outcomes ".forgeflow/$(basename "$PWD")/review-outcomes.jsonl" \
  --context-root .forgeflow \
  --public \
  --out ".forgeflow/$(basename "$PWD")/evaluation-summary.md"
```

For timestamped summary storage and inspection steps, use [Pilot Public Summary](Pilot-Public-Summary.md).

## Closeout

Classify the pilot result:

| Result | Use When | Next Step |
|---|---|---|
| repeat-pilot | useful signal, but more evidence needed | run another bounded branch |
| expand-small-team | setup and review quality are good enough | invite one or two maintainers |
| stop-and-fix | setup, privacy, routing, context, or quality blocked trust | create a targeted fix |
| defer | useful locally, but no team rollout demand yet | keep Forgeflow opt-in |

Move repeated issues into [Friction To Fix](Friction-To-Fix.md) and use [Pilot Support Rollup](Pilot-Support-Rollup.md) once there is more than one pilot. Keep CI and headless review deferred unless [CI And Headless Deferrals](CI-Headless-Deferrals.md) says there is enough demand.
