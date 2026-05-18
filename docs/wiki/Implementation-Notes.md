# Implementation Notes

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

Specialist implementers report implementation note candidates in their outputs. Atlas serializes those candidates into `implementation-notes.md` at wave checkpoints so parallel agents do not race on one shared file. When available, Atlas uses `scripts/forgeflow/record-implementation-notes.js` to append entries from a JSON candidate list. Arbiter verifies the file during integration and may add final integration notes when needed.

The file is append-oriented during a run. Existing entries should not be rewritten except to fix a malformed entry from the same run.

## Privacy Boundary

Do not record secrets, raw settings JSON, tokens, keys, certificates, private URLs, customer names, or large source snippets. If sensitive context influenced a decision, record the decision class and point to the relevant safe documentation instead of pasting private values.

`/review` may use implementation notes as context for spec drift and tradeoffs, but notes are not proof that the code is correct. `/ship` summarizes the notes for handoff and presentation; it does not dump the raw log.

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

## Suggested Format

```markdown
## Decisions

- 2026-05-18 | Atlas | decision | Chose Markdown as canonical notes format because it is local, diffable, and easy for agents to append.

## Spec Gaps

- 2026-05-18 | Arbiter | spec-gap | The spec did not define note ownership; Atlas serializes candidates to avoid parallel writes.

## Tradeoffs

## Deviations

## Follow-ups

## Validation Notes
```
