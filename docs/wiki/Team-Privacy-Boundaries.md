# Team Privacy Boundaries

Use this during team trials to decide what Forgeflow data stays local, what can be shared with the project team, and what is safe to include in public summaries.

## Default Rule

Keep raw Forgeflow state local unless the project explicitly decides otherwise. Share aggregate summaries first, then expand only when the receiving audience is allowed to see the underlying project context.

## Data Classes

| Data | Default | Why |
|---|---|---|
| `.forgeflow/<project>/review-outcomes.jsonl` | local only | Can include branch details, review notes, finding classes, and triage outcomes |
| context packets and memory summaries | local only | May contain source-derived context, file paths, task details, and implementation notes |
| telemetry JSONL rows | local only | Can reveal project paths, workflow timing, and repeated issue classes |
| generated public summaries | share after review | Designed for aggregate quality and context-efficiency evidence |
| screenshots of public summaries | share after review | Useful for pilots when raw files should not leave the machine |
| sanitized examples | share after review | Good for demos, release notes, and external feedback |

## Team Trial Sharing Levels

### Local Maintainer

Use this for the first pilot.

- Keep `.forgeflow/` uncommitted.
- Keep raw records on the maintainer machine.
- Record only a short pilot summary in notes or an issue.
- Use [Maintainer Pilot](Maintainer-Pilot) for pass and stop criteria.

### Private Team

Use this after the maintainer wants one or two teammates to evaluate the result.

- Share `evaluation-summary.md` or screenshots.
- Share confirmed findings only when normal project review policy allows it.
- Keep raw JSONL, context packets, and memory summaries local unless the team explicitly agrees.
- Track friction using [First-Run Friction](First-Run-Friction) or [Friction To Fix](Friction-To-Fix).

### Public Or External

Use this for release notes, examples, marketplace copy, or outside feedback.

- Share only aggregate tables, screenshots, or sanitized examples.
- Remove private project names, customer names, branch names, internal URLs, and proprietary feature names.
- Do not share raw records, context packets, memory summaries, or telemetry rows.
- Use [Evaluation Sharing](Evaluation-Sharing) and [Public-Safe Examples](Public-Examples) before posting.

## Before Sharing Checklist

Review the generated summary:

```bash
sed -n '1,220p' .forgeflow/<project>/evaluation-summary.md
```

Check for:

- private project or customer names
- private branch names
- source file paths that reveal sensitive architecture
- proprietary feature names
- security findings that need disclosure approval
- raw reviewer comments with code references

If any item appears, generalize it or do not share the file.

## Optional Sharing Record

Keep this note with the pilot:

```yaml
sharing_level: local-maintainer | private-team | public
shared_artifact: none | summary | screenshot | sanitized-example
raw_records_shared: yes | no
context_artifacts_shared: yes | no
approval_source:
redactions_made:
follow_up:
```
