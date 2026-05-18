# Team Adoption Criteria

Use this after one or more maintainer pilots to decide whether Forgeflow is ready to expand beyond one maintainer.

For a decision worksheet that compares pilot evidence against these criteria, use [Pilot Adoption Comparison](Pilot-Adoption-Comparison).

## Decision States

| State | Meaning | Next Step |
|---|---|---|
| repeat pilot | useful signal, but evidence is thin or friction remains | run another bounded branch trial |
| expand to small team | useful signal with manageable friction | invite one or two more maintainers |
| stop and fix | blocking setup, privacy, routing, or quality issue | fix the blocker before more trials |
| defer broader rollout | pilot works, but the team does not need more automation yet | keep Forgeflow as an opt-in maintainer tool |

## Minimum Evidence

Before expanding, collect:

- at least two real branch reviews, or one review with a clear material finding
- one completed [Maintainer Pilot](Maintainer-Pilot) summary
- one selected sharing level from [Team Privacy Boundaries](Team-Privacy-Boundaries)
- support issues classified with [Support Triage](Support-Triage)
- local evidence of install and health status

Use public summaries when possible, but do not require public sharing for private teams.

## Expand Criteria

Expand to one or two more maintainers when all of these are true:

- setup can be repeated from docs without live hand-holding
- `/forgeflow-health` or Codex discovery checks have clear pass, warn, or fix output
- findings are specific enough for maintainers to confirm or reject
- false positives are not high enough to make maintainers avoid rerunning Forgeflow
- local state and summary sharing boundaries are understood
- any support issue has an owner, a category, and a next step

## Stop Criteria

Stop and fix before expanding when any of these are true:

- a maintainer cannot reach first review after following install and recovery docs
- raw local state must be shared to explain the result
- routing repeatedly selects the wrong review mode for similar branches
- review findings repeatedly lack file references or evidence
- context artifacts are too large or too specific to handle safely
- privacy or disclosure approval is unclear

## Evidence Summary

Keep this note local unless the team approves sharing it:

```yaml
pilot_count:
runtimes:
project_types:
health_results:
confirmed_findings:
rejected_findings:
average_review_minutes:
setup_blockers:
support_categories:
sharing_level:
decision: repeat-pilot | expand-small-team | stop-and-fix | defer
decision_reason:
owner:
next_review_date:
```

## Expansion Path

If the decision is `expand-small-team`:

1. Pick one additional maintainer and one bounded branch.
2. Reuse [Maintainer Pilot](Maintainer-Pilot).
3. Keep [Team Privacy Boundaries](Team-Privacy-Boundaries) unchanged unless the team explicitly revises them.
4. Track support with [Support Triage](Support-Triage).
5. Keep CI and headless review deferred with [CI And Headless Deferrals](CI-Headless-Deferrals) until maintainers ask for automation.
6. Revisit this decision after the next two reviews.
