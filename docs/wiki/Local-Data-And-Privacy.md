# Local Data And Privacy

Forgeflow is local-first.

## Local State

Workflow state is stored under:

```text
.forgeflow/<project-name>/
```

This can include:

- discussion notes
- research summaries
- plans
- implementation briefs
- implementation notes
- review history
- calibration summaries
- review outcome records
- local agent notes
- context packets
- compact memory summaries
- scope manifests
- context telemetry
- context advisor history
- code topology and code-map history
- latest-insights readiness reports
- project operating model snapshots
- architecture, ownership, invocation-hint, dogfood-report, and dogfood-refresh evidence
- review-auto sandbox and apply evidence
- first-run, pilot, agent-feedback, next-work, and review outcome records

User operating preferences are stored under:

```text
~/.claude/forgeflow/user-operating-profile.jsonl
```

Project experience preferences are stored under:

```text
.forgeflow/<project-name>/project-experience-profile.jsonl
```

These profile records are local advisory guidance. Keep global user operating preferences free of project names, private URLs, source snippets, customer names, raw settings, and secrets. Project experience preferences should stay project-local and should not become global defaults unless the user explicitly records them as global operating preferences.

## Telemetry

Forgeflow telemetry is JSONL and is intended for local use:

```text
~/.claude/projects/<project>/memory/forgeflow-metrics.jsonl
```

Telemetry helps summarize:

- review verdicts
- auto-fix rounds
- findings overturned by Arbiter
- Aegis verification decisions
- accepted and rejected outcome records
- estimated context savings
- context budget warnings
- context advisor recommendations and trend deltas

Project-local context trend history is stored at:

```text
.forgeflow/context-advisor-history.jsonl
```

This file is compact local telemetry. It records token estimates, savings, budget status, violation counts, and recommendation actions from context advisor runs.

Project code-map trend history is stored at:

```text
.forgeflow/<project-name>/context/code-map-history.jsonl
```

This file is compact local topology telemetry. It records summary counts, top hotspots, changed-section hints, provenance source, and previous-run comparison inputs. It does not store file contents. The code-map helper retains the latest 50 snapshots by default.

## Sharing

Nothing in the local workflow requires hosted telemetry. If you enable team sync, review what state files are copied and use a private remote.

For evaluation output, share aggregate summaries by default:

```bash
scripts/forgeflow/render-evaluation-report.js --outcomes .forgeflow/<project>/review-outcomes.jsonl --context-root .forgeflow --public --out .forgeflow/<project>/evaluation-summary.md
```

Keep raw `review-outcomes.jsonl`, user/profile records, context packets, memory summaries, implementation notes, and telemetry rows local unless the receiving audience is allowed to see the underlying project context. For team trials, use [Team Privacy Boundaries](Team-Privacy-Boundaries) to choose between local-maintainer, private-team, and public sharing levels. See [Evaluation Sharing](Evaluation-Sharing) and [Public-Safe Examples](Public-Examples).

Support bundles include a snippet-free redaction preview that reports sensitive categories and counts without showing the matched values. Use it as a starting point, not as proof that the bundle is public-safe.

Implementation notes live at `.forgeflow/<project-name>/implementation-notes.md`. They are local handoff context for decisions, spec gaps, tradeoffs, deviations, follow-ups, and validation notes discovered during `/implement`. Keep them out of commits and do not paste secrets, raw settings JSON, tokens, private URLs, customer names, or large source snippets into the file.

The local dashboard reads metrics from `~/.claude/projects/<project>/memory/forgeflow-metrics.jsonl` and project readiness from `.forgeflow/<project-name>/context/` and `.forgeflow/<project-name>/release-readiness/`. The dashboard server is local-only, serves API responses with `Cache-Control: no-store`, and the Project Readiness panel copies suggested commands instead of executing them.

## Sensitive Files

Forgeflow commands are designed to avoid reading secrets such as `.env`, keys, certificates, and token-like filenames during review context loading.

Context helpers use deny rules for generated, dependency, and sensitive-looking paths when building scope and context artifacts. Review generated packets before sharing them outside your machine.
