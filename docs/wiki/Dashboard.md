# Dashboard

Forgeflow has two local dashboard surfaces. Both are optional.

## Metrics Dashboard

Run:

```text
/dashboard
```

The metrics dashboard starts a read-only local server at:

```text
http://127.0.0.1:4003
```

Use it when you want to inspect Forgeflow activity across projects:

- verdict trends
- reviewer and verifier outcomes
- auto-fix activity
- project-level usage
- parse warnings in local telemetry
- current project readiness signals

The dashboard reads local telemetry from:

```text
~/.claude/projects/<project>/memory/forgeflow-metrics.jsonl
```

It does not send telemetry to a hosted service.

The dashboard also exposes a read-only project readiness endpoint:

```text
GET /api/readiness
```

That endpoint reads existing local Forgeflow artifacts for project health, latest insights, context budget, release readiness, dogfood report status, and the dogfood refresh-plan next action. It does not refresh artifacts, write files, run shell commands, spawn agents, call GitHub, or export telemetry.

## Agent Chat Dashboard

Run:

```text
/agent-chat:on
```

The agent-chat dashboard starts at:

```text
http://127.0.0.1:4001
```

Use it when you want to watch agent messages during a live multi-agent workflow. It is separate from the metrics dashboard and is backed by the agent-chat server on local ports `4000` and `4001`.

## Which One To Use

Use `/dashboard` after reviews or workflows have run and telemetry exists.

Use `/agent-chat:on` before a workflow when you want live message observability.

Skip both for normal Forgeflow use. The main lifecycle commands work without any dashboard running.

## Stop The Metrics Dashboard

```bash
kill "$(cat /tmp/dashboard.pid)"
```

If the PID file is stale, identify the process on port `4003` and stop that process.
