# Pilot Next Action Decision

Use this after [Pilot Adoption Comparison](Pilot-Adoption-Comparison) to choose the next action from the pilot evidence. The decision should be based on observed trial evidence, not roadmap preference.

## Allowed Decisions

| Decision | Use When | Follow-Up |
|---|---|---|
| product-fix | a repeated blocker or first-review blocker has a clear fix layer | create the smallest docs, install, health, routing, context, or review-quality fix |
| another-pilot | evidence is useful but still thin | run one more bounded maintainer pilot |
| small-team-expansion | setup, privacy, support, and review quality are ready for one or two more maintainers | expand with the same privacy boundaries and local evidence rules |
| continue-deferral | Forgeflow works locally, but team rollout or CI/headless demand is absent | keep Forgeflow opt-in and revisit later |

Do not choose CI or headless automation as the next action unless [CI And Headless Deferrals](CI-Headless-Deferrals) shows explicit maintainer demand.

## Decision Inputs

Use:

- the decision from [Pilot Adoption Comparison](Pilot-Adoption-Comparison)
- repeated blockers from [Pilot Support Rollup](Pilot-Support-Rollup)
- sharing level from [Team Privacy Boundaries](Team-Privacy-Boundaries)
- summary availability from [Pilot Public Summary](Pilot-Public-Summary)
- maintainer rerun signal from [Pilot Evidence Log](Pilot-Evidence-Log)

Keep the input links local unless the team approves sharing them.

## Decision Record

```yaml
decision: product-fix | another-pilot | small-team-expansion | continue-deferral
evidence_window:
pilot_count:
maintainer_rerun_signal: yes | no | mixed | unknown
dominant_support_categories:
privacy_status: ready | blocked | mixed
summary_status: generated | local-only | not-ready
ci_headless_demand: yes | no | unknown
decision_reason:
owner:
next_action:
validation_needed:
review_after:
```

## Decision Rules

Choose `product-fix` when:

- one support category repeats across pilots
- one issue blocks first review
- privacy or summary review repeatedly blocks sharing
- review quality or routing failures would stop maintainers from rerunning Forgeflow

Choose `another-pilot` when:

- no blocker repeats yet
- one more branch would clarify setup, review quality, or privacy friction
- the maintainer signal is mixed or unknown

Choose `small-team-expansion` when:

- the adoption comparison recommends expansion
- support issues have owners and no first-review blocker remains
- privacy boundaries are accepted
- CI/headless automation remains deferred unless explicitly requested

Choose `continue-deferral` when:

- maintainers are not asking for team rollout
- Forgeflow remains useful as a local opt-in workflow
- CI/headless automation has no clear demand

## Closeout

Update the local pilot evidence note with the decision. If the decision is `product-fix`, use [Friction To Fix](Friction-To-Fix) to choose the fix layer. If the decision is `small-team-expansion`, reuse [Maintainer Pilot](Maintainer-Pilot) for each added maintainer.
