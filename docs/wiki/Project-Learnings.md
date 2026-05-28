# Project Learnings

Forgeflow project learnings are durable local guidance about how work tends to go in one repository.

They answer a different question than pilot evidence:

- Pilot evidence asks whether Forgeflow is working well for maintainers.
- Project learnings ask what repeated work items reveal about the project itself.

## Artifact

```text
.forgeflow/<project-name>/project-learnings.md
```

The file is local project state. It should stay under `.forgeflow/` and should not be committed unless the project explicitly chooses to share a sanitized version.

Refresh it from local implementation notes, review outcomes, and ship metadata:

```bash
scripts/forgeflow/show-project-learnings.js
```

For the current checkout, `show-project-learnings.js` refreshes `.forgeflow/<project-name>/context/code-topology.json` first, then uses it as structural input. High fan-in/fan-out paths and files with changed sections become Hot Files And Modules signals, and changed-section counts can shape Recommended Approach For Next Work. When `.forgeflow/<project-name>/context/code-map-history.jsonl` has at least two snapshots, new hotspots, unresolved-import growth, and changed-section churn also feed the rollup.

`/ship` also refreshes the file and writes `.forgeflow/<project-name>/ship/project-learnings-rollup.json` for the shipping handoff. `/forgeflow-health` reports the latest local project-learnings summary plus latest-insights readiness/freshness when those artifacts exist and recommends `/forgeflow-trends --refresh` when latest insights are stale. `/forgeflow-trends` combines code-map freshness, project-learning consumption, and latest-insights freshness into one project guidance health view. Use `/forgeflow-trends --refresh` to refresh project learnings and latest-insights readiness before rendering that view; stale reports recommend that command directly.

During `/implement`, Atlas refreshes project learnings after implementation-note consolidation when the helper is available. This lets the artifact accumulate signal during long work items instead of waiting for the final ship handoff.

Atlas can also record structured candidates in:

```text
.forgeflow/<project-name>/project-learning-candidates.jsonl
```

Use `scripts/forgeflow/record-project-learning.js` for explicit categories: `recurring-pitfall`, `stable-decision`, `risk-area`, `validation-pattern`, `hot-file`, `repeated-follow-up`, and `recommended-approach`.

Structured candidates may also include `confidence` (`low`, `medium`, or `high`), `evidence_count`, compact `application_guidance`, `status` (`active`, `stale`, or `superseded`), and `superseded_by` replacement guidance. The rollup keeps support weight visible in active agent-facing insight bullets, uses active candidates' `evidence_count` when ranking risk areas and hot files, omits inactive candidates from guidance, shows a compact inactive-candidate source summary, and writes `Generated at` freshness metadata.

Use `scripts/forgeflow/record-agent-feedback.js` when a reviewer, implementer, or planner gave guidance that was useful, unclear, ignored, or incorrect. The helper writes local feedback to `.forgeflow/<project-name>/agent-feedback.jsonl`. Add `--promote` only after the feedback has medium or high confidence and `--evidence-count 2` or higher; promotion appends a structured project-learning candidate with a proof-boundary reminder.

The project intelligence rollup summarizes that feedback as advisory signal only. It can show corrective feedback counts, correction themes, skipped invalid/private lines, promotable counts, manual-promotion candidates, stale markers, confidence/evidence metadata, and latest summaries in review-prep notes, but agents must still verify current code, tests, and review artifacts before relying on the feedback.

From Claude Code, run:

```text
/forgeflow-learnings --project
/forgeflow-learnings --project --check
```

That refreshes the artifact and prints the insight sections in a user-facing order. Add `--check` to also run the project-learnings quality check from the command surface.

Review context packs also include compact **Latest Insights**, **Latest Failure Digest**, and **Project Code Map** sections in each agent packet. Agents can use them to adjust attention while reviewing, but they still need current code, test, and artifact evidence for every finding. Context packs inject the insights only when the project-learnings checker passes; warn or fail results produce a compact quality-gate warning instead. Failure digests include freshness metadata so stale summaries are labeled before agents use them. The generated context pack includes `latest-insights-report.json` with the gate status and top check issues. Use `/forgeflow-insight-injection` to inspect the latest packet artifact decisions, per-agent signal contracts, and clearing commands before agent-heavy work.

For a single review-prep summary, build the project intelligence rollup:

```bash
scripts/forgeflow/build-project-intelligence.js --json
```

It writes `.forgeflow/<project-name>/context/project-intelligence-rollup.json` and `.md` with trust state, freshness, Git provenance, top risks, hot files, validation patterns, agent-feedback summary, aggregate review-outcome learning signals, recommended next actions, artifact pointers, a next-work brief, advisory next-work item candidates, and a review-prep block. The next-work brief gives the next implementer compact read-first, avoid-first, validate-first, and proof-boundary guidance. The next-work items turn readiness, risk, feedback, review-outcome, and review-prep signals into candidate slices with evidence strength, what-to-change, how-to-prove, stop-when, start, validation, and proof-boundary fields. The review-prep block separates runnable refresh commands, advisory notes, files/signals to read first, and validation patterns to run first. The separate agent-feedback section shows advisory feedback metadata, skipped-line counts, skipped reasons, by-agent counts, correction themes, promotion candidates, and stale markers. The review-outcome section shows aggregate true-positive, false-positive, missed-issue, stale-guidance, and manual-promotion-candidate counts without copying raw outcome records. The rollup refreshes project learnings and compact code-map context before synthesis unless `--refresh` already refreshed trends and project guidance; it does not replace raw trends, code maps, failure digests, feedback logs, review outcomes, or project learnings.

Use `scripts/forgeflow/build-project-intelligence.js --next-work` for the same generated advisory candidates in a compact human-readable view without the full rollup sections. Use `scripts/forgeflow/build-project-intelligence.js --brief 1` to render an advisory implementation-brief stub for a selected candidate; it includes evidence strength, the concrete action/proof/stop fields, suggested review lanes, implementation-notes seed prompts, and a handoff checklist, but you still need to confirm product intent and validation before treating it as a real work plan.

Check the local artifact before relying on it:

```bash
scripts/forgeflow/check-project-learnings.js --json
```

The checker catches sensitive content, placeholder-only output, oversized packets, duplicate bullets, malformed structured candidates, invalid confidence or status metadata, oversized application or replacement guidance, stale generated metadata, and missing proof-boundary text. `/forgeflow-health` surfaces non-passing project-learning checks when present.

## What Goes In

Use project learnings for patterns that should shape future work:

- recurring implementation pitfalls
- stable project decisions
- risky files, modules, or workflows
- structural hotspots, changed sections, and trend deltas from the latest code map
- repeated validation gaps
- repeated review finding categories
- follow-ups that keep reappearing
- project-specific approaches that worked well

Do not use project learnings as a raw log. Keep implementation details in implementation notes, review evidence in review outcomes, and final release context in ship summaries.

## Suggested Format

```markdown
# Project Learnings

## Recurring Pitfalls

- Release-helper changes often require matching install-manifest, health, release-check, docs, and focused test updates.

## Stable Decisions

- Markdown is the canonical local artifact format for human-editable Forgeflow state.

## Risk Areas

- Local artifacts that summarize project context need sensitive-content checks before they are written or shared.

## Validation Patterns

- Runtime-helper additions should run focused helper tests plus the full local release-check equivalent.

## Hot Files And Modules

- scripts/forgeflow/install-manifest.js
- commands/forgeflow-release-check.md

## Repeated Follow-ups

- Keep README and wiki entry points aligned after adding new workflow helpers.

## Recommended Approach For Next Work

- Start by checking existing helper patterns, then add manifest, health, release-check, docs, and tests in the same slice.
```

## Agent Consumption

Future Forgeflow phases may read this file as project guidance:

- `/consult` can include known project pitfalls in implementation briefs.
- `/implement` can nudge agents toward established local patterns.
- `/review` can focus attention on repeated risk areas.
- `/ship` can include unresolved project risks in the final handoff.

Project learnings are guidance only. Agents must verify current findings against current code, tests, and artifacts.

## Privacy Boundary

Do not record secrets, raw settings JSON, source snippets, customer names, private URLs, tokens, keys, certificates, or private architecture details that should not leave the machine.

Record the pattern instead of the private value:

```text
Good: Private URL handling has repeatedly needed redaction tests.
Bad: The internal dashboard URL is https://example.internal/team.
```

## Relationship To Other Local Artifacts

| Artifact | Purpose |
|---|---|
| `implementation-notes.md` | Per-work-item decisions, tradeoffs, gaps, deviations, follow-ups, and validation notes. |
| `review-outcomes.jsonl` | Triage and measurement data for review quality. |
| `ship/ship-summary.json` | Final release summary and handoff data for one shipped branch. |
| `pilot-evidence/*.yml` | Maintainer-trial evidence about Forgeflow adoption and friction. |
| `pilot-evidence-rollup.md` | Aggregate adoption/support signal across maintainer pilots. |
| `project-learnings.md` | Durable project patterns that should guide future work items. |

## V1 Scope

V1 should create and use the local learning artifact. It should not automatically rewrite prompts, sync learnings across teams, prune stale learnings, export shared versions, or run in CI.
