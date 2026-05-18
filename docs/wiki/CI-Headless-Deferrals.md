# CI And Headless Deferrals

Use this during team trials to decide which CI or headless-review ideas should stay deferred until maintainers show they need them.

Forgeflow already has CI and headless review references, but team trials should begin with maintainer-controlled local reviews. Automation should follow evidence, not lead it.

## Defer By Default

Keep these deferred during the first team trials:

- running Forgeflow on every pull request
- enabling `/review-auto --ci` to push fixes from CI
- failing PR checks on Forgeflow verdicts
- sharing raw verdict JSON outside the project
- adding team-wide sync for local memory or telemetry
- tuning CI routing caps before local review quality is understood

These are not rejected ideas. They need trial evidence and team consent before becoming default workflow.

## Consider CI Later When

Revisit CI or headless review when all of these are true:

- at least two maintainers would rerun Forgeflow after local pilots
- support issues have owners and are not blocking first review
- privacy boundaries are understood for summaries, verdict JSON, and local state
- review findings are specific enough to act on without live explanation
- routing quality is stable across the branch types the team cares about
- the team wants Forgeflow comments or gates on PRs, not just local guidance

Use [Team Adoption Criteria](Team-Adoption-Criteria) before moving from local trials to CI.

## Evidence To Collect First

Before enabling CI, collect:

```yaml
pilot_count:
maintainers_involved:
project_types:
confirmed_findings:
rejected_findings:
average_review_minutes:
support_categories:
privacy_level:
desired_ci_mode: review-only | review-and-fix | none
fail_pr_on_revise: yes | no | undecided
```

If `desired_ci_mode` is `none` or `undecided`, keep CI deferred.

## Safe Next Step

If the team wants automation, start with review-only and non-blocking output:

- no auto-fix pushes
- no failing PR check at first
- no raw local state in comments or artifacts
- conservative routing cap
- one repository only
- one or two maintainers watching the first runs

Only consider review-and-fix after maintainers trust review-only output.

## Deferral Record

Keep this note in the pilot record:

```yaml
ci_headless_decision: defer | review-only-later | pilot-review-only | stop
reason:
evidence_needed:
owner:
review_after:
```

The default decision is `defer` until a team trial shows demand.
