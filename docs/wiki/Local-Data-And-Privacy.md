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
- context packets
- compact memory summaries
- scope manifests
- context telemetry
- context advisor history

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

## Sharing

Nothing in the local workflow requires hosted telemetry. If you enable team sync, review what state files are copied and use a private remote.

## Sensitive Files

Forgeflow commands are designed to avoid reading secrets such as `.env`, keys, certificates, and token-like filenames during review context loading.

Context helpers use deny rules for generated, dependency, and sensitive-looking paths when building scope and context artifacts. Review generated packets before sharing them outside your machine.
