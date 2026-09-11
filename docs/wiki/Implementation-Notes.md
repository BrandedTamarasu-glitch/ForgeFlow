# Implementation Notes

The same artifact contract applies to `/implement` in Claude Code and `$implement` in Codex. Source-relative helper examples below require the ForgeFlow checkout; use the [installed runtime path](Workflow-Commands.md#choose-your-host) when working in another repository.

Forgeflow keeps a running implementation notes file while `/implement` executes a brief.

## Artifact

```text
.forgeflow/<project-name>/implementation-notes.md
```

The file is local project state. It is created by `ensure-forgeflow-state.sh` or lazily by `/implement`, and `.forgeflow/` should stay gitignored.

## What Goes In

Use the notes for information the user should know after implementation:

- Decisions not spelled out in the spec
- Spec gaps or ambiguous requirements that had to be resolved
- Tradeoffs made during the build
- Deviations from the plan or implementation brief
- Follow-ups that should not be lost
- Validation notes, manual checks, and test limitations

## Ownership

Specialist implementers report implementation note candidates in their outputs. Coordinator serializes those candidates into `implementation-notes.md` at wave checkpoints so parallel agents do not race on one shared file. When available, Coordinator uses `scripts/forgeflow/record-implementation-notes.js` to append entries from a JSON candidate list. Architect verifies the file during integration and may add final integration notes when needed.

When lean guidance chooses a smaller path with a known ceiling, `/consult` and `/implement` write `.forgeflow/<project>/context/lean-decision.json`. Coordinator can append the ceiling and upgrade trigger with:

```bash
scripts/forgeflow/record-implementation-notes.js --project-dir .forgeflow/<project-name> --lean-decision .forgeflow/<project-name>/context/lean-decision.json --json
```

Use implementation notes for this tradeoff. Add inline code comments only when the code would otherwise be unclear later.

The file is append-oriented during a run. Existing entries should not be rewritten except to fix a malformed entry from the same run.

## Privacy Boundary

Do not record secrets, raw settings JSON, tokens, keys, certificates, private URLs, customer names, or large source snippets. If sensitive context influenced a decision, record the decision class and point to the relevant safe documentation instead of pasting private values.

`/review` may use implementation notes as context for spec drift and tradeoffs, but notes are not proof that the code is correct. During `/ship`, curate relevant notes for the handoff using current evidence; the preparation helper does not import the historical log.

Use `scripts/forgeflow/ship-prepare.sh --task <id> "Title"` with the task selected for the current objective. It verifies source and artifact freshness using the task store and separates the latest automated, manual and review evidence for each criterion. Failed, stale, missing, waived and pending outcomes remain visible. Without `--task`, current validation is explicitly missing; the helper does not infer a task from recency or search Markdown for passing results. An invalid task fails without replacing the previous summary. Historical project notes remain available as references for manual curation, and task readiness never implies reviewer approval.

## Quality Check

Run the local checker when piloting or auditing the notes workflow:

```bash
scripts/forgeflow/check-implementation-notes.js --json
```

The checker reports missing files, missing sections, empty notes, obvious sensitive-content patterns, legacy ship-summary keys, and raw log metadata that leaked into `ship-summary.json`. By default, missing or empty notes are warnings; obvious sensitive content is a failure. Use `--strict` when missing or empty notes should fail a pilot run.

For a specific project-local state directory:

```bash
scripts/forgeflow/check-implementation-notes.js --project-dir .forgeflow/<project-name> --json
```

During ship prep, Forgeflow writes the checker result to `.forgeflow/<project-name>/ship/implementation-notes-check.json` and includes its status in the generated PR body. Warnings remain visible; failures stop shipping.

## Suggested Format

```markdown
## Decisions

- 2026-05-18 | Coordinator | decision | Chose Markdown as canonical notes format because it is local, diffable, and easy for agents to append.

## Spec Gaps

- 2026-05-18 | Architect | spec-gap | The spec did not define note ownership; Coordinator serializes candidates to avoid parallel writes.

## Tradeoffs

## Deviations

## Follow-ups

## Validation Notes
```
