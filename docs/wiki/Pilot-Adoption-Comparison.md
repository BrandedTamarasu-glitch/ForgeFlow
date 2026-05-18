# Pilot Adoption Comparison

Use this after collecting pilot evidence to compare outcomes against [Team Adoption Criteria](Team-Adoption-Criteria). This does not replace maintainer judgment. It makes the decision explicit and repeatable.

## Inputs

Use local or sanitized summaries from:

- [Pilot Evidence Log](Pilot-Evidence-Log)
- [Pilot Public Summary](Pilot-Public-Summary)
- [Pilot Support Rollup](Pilot-Support-Rollup)
- [Team Privacy Boundaries](Team-Privacy-Boundaries)

Do not include raw review records, source snippets, full reviewer comments, or raw context artifacts in the comparison note.

## Comparison Worksheet

```yaml
pilot_count:
runtime_coverage:
project_types:
health_ready: yes | no | mixed
setup_repeatable: yes | no | mixed
review_findings_actionable: yes | no | mixed
false_positive_tolerance: acceptable | too-high | unknown
privacy_ready: yes | no | mixed
support_ready: yes | no | mixed
context_ready: yes | no | not-run
maintainer_would_rerun: yes | no | mixed
ci_or_headless_demand: yes | no | unknown
recommended_decision: repeat-pilot | expand-small-team | stop-and-fix | defer
decision_reason:
```

## Decision Rules

Choose `expand-small-team` only when:

- setup is repeatable without live help
- health or Codex discovery checks are understandable
- findings are actionable enough for maintainers to triage
- false positives are acceptable
- privacy boundaries are understood
- support issues have categories and owners

Choose `stop-and-fix` when:

- first review is blocked
- raw local state would need to be shared to explain the result
- routing or review quality repeatedly fails on similar branches
- privacy or disclosure approval is unclear

Choose `repeat-pilot` when:

- the signal is useful but evidence is thin
- one more branch would clarify quality, routing, or setup friction
- support issues are minor and not repeated yet

Choose `defer` when:

- Forgeflow works as an opt-in maintainer tool
- the team does not want broader rollout or automation yet
- CI/headless demand is absent or unknown

## Output

Record the decision locally:

```yaml
decision:
owner:
next_action:
review_after:
evidence_links:
known_deferrals:
```

Use [Pilot Next Action Decision](Pilot-Next-Action-Decision) to turn this comparison into the next action. If the decision is `stop-and-fix`, create the smallest fix using [Friction To Fix](Friction-To-Fix). If the decision is `expand-small-team`, keep CI and headless automation deferred until [CI And Headless Deferrals](CI-Headless-Deferrals) says there is demand.
