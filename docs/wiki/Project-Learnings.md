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

Structured candidates may also include `confidence` (`low`, `medium`, or `high`), `evidence_count`, and compact `application_guidance` to show how much support the guidance has and how agents should use it. The rollup keeps that weight visible in agent-facing insight bullets, uses `evidence_count` when ranking risk areas and hot files, and writes `Generated at` freshness metadata.

From Claude Code, run:

```text
/forgeflow-learnings --project
/forgeflow-learnings --project --check
```

That refreshes the artifact and prints the insight sections in a user-facing order. Add `--check` to also run the project-learnings quality check from the command surface.

Review context packs also include compact **Latest Insights**, **Latest Failure Digest**, and **Project Code Map** sections in each agent packet. Agents can use them to adjust attention while reviewing, but they still need current code, test, and artifact evidence for every finding. Context packs inject the insights only when the project-learnings checker passes; warn or fail results produce a compact quality-gate warning instead. Failure digests include freshness metadata so stale summaries are labeled before agents use them. The generated context pack includes `latest-insights-report.json` with the gate status and top check issues.

Check the local artifact before relying on it:

```bash
scripts/forgeflow/check-project-learnings.js --json
```

The checker catches sensitive content, placeholder-only output, oversized packets, duplicate bullets, malformed structured candidates, invalid confidence metadata, oversized application guidance, stale generated metadata, and missing proof-boundary text. `/forgeflow-health` surfaces non-passing project-learning checks when present.

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
