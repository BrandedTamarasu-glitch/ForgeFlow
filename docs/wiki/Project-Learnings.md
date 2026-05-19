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
scripts/forgeflow/rollup-project-learnings.js --json
```

## What Goes In

Use project learnings for patterns that should shape future work:

- recurring implementation pitfalls
- stable project decisions
- risky files, modules, or workflows
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
