# Pilot Support Rollup

Use this after two or more maintainer pilots to find repeated support blockers. Keep raw pilot notes local and roll up only categories, counts, and sanitized observations.

## Inputs

Use local notes from:

- [Pilot Evidence Log](Pilot-Evidence-Log)
- [Support Triage](Support-Triage)
- [First-Run Friction](First-Run-Friction)
- [Friction To Fix](Friction-To-Fix)

Do not copy raw `.forgeflow/` artifacts, full settings files, source snippets, or private branch names into the rollup.

## Rollup Template

```yaml
pilot_count:
runtimes:
project_types:
blocked_first_review_count:
repeat_issue_count:
support_categories:
  install:
  health:
  settings:
  template-installer:
  codex-discovery:
  agent-routing:
  context-budget:
  review-quality:
  privacy:
  docs:
top_blockers:
fixed_this_round:
next_fix_layer:
owner:
```

## Category Rules

Use the first layer that could have prevented the problem:

| Category | Use When |
|---|---|
| `install` | managed files are missing, corrupt, or not executable |
| `health` | health output is wrong, unclear, or missing a real failure |
| `settings` | hook or statusline wiring is confusing or stale |
| `template-installer` | Codex or Claude template copy behavior is unclear |
| `codex-discovery` | files exist but Codex does not show agents or skills after restart |
| `agent-routing` | review mode or specialist selection is wrong for the branch |
| `context-budget` | context packets are too large or savings are repeatedly low |
| `review-quality` | findings lack evidence, severity is unclear, or false positives repeat |
| `privacy` | summary or sharing level is unclear or too specific |
| `docs` | the fix existed but the maintainer had to search for it |

## Repeated Blocker Rule

Create a product or docs fix when:

- the same category appears in at least two pilots
- one issue blocks first review entirely
- one issue would force sharing raw local state to explain the result
- a maintainer says the friction would stop them from rerunning Forgeflow

If none of those are true, run another pilot before changing product behavior.

## Next Action Mapping

| Dominant Category | Next Action |
|---|---|
| install, template-installer | improve installer output, manifest coverage, or clean-checkout verification |
| health, settings | improve `/forgeflow-health` diagnostics or settings docs |
| codex-discovery | improve Codex first-run verification and restart guidance |
| agent-routing, review-quality | tune routing docs, reviewer prompts, or evidence standards |
| context-budget | add examples, advisor guidance, or budget defaults based on evidence |
| privacy | tighten sharing boundaries and public-summary inspection |
| docs | move the missing step closer to the start path |

## Closeout

Record the result:

```yaml
decision: fix-now | run-another-pilot | expand-small-team | defer
reason:
linked_categories:
validation_needed:
```

Use [Team Adoption Criteria](Team-Adoption-Criteria) to decide whether the rollup supports expansion.
