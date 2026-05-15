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
- review history
- calibration summaries
- review outcome records
- local agent notes

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

## Sharing

Nothing in the local workflow requires hosted telemetry. If you enable team sync, review what state files are copied and use a private remote.

## Sensitive Files

Forgeflow commands are designed to avoid reading secrets such as `.env`, keys, certificates, and token-like filenames during review context loading.
