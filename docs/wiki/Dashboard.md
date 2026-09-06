# The ForgeFlow Workshop

The workshop at **http://127.0.0.1:4003/** combines Ember, project readiness, review outcomes, trends, and live activity. It is optional; the main workflows work without it.

Start with the [annotated visual guide](../user-guide.html#dashboard) or [printable PDF](../ForgeFlow-User-Guide.pdf).

![ForgeFlow workshop with Ember, project health, review totals, trends, and live activity](../images/forgeflow-workshop.png)

## Opening the workshop

The first eligible ForgeFlow workflow invocation in a desktop session starts or reuses the dashboard and activity service, reports the phase, and opens your browser once. Later invocations ensure the services and update activity without opening another tab, even if you closed the first one.

Automatic startup requires installed dependencies and a stable host session ID. CI, SSH, headless Linux, and `FORGEFLOW_DASHBOARD_AUTO_OPEN=off` skip it. It never installs packages automatically.

For manual startup, run this from the repository whose readiness you want to see:

```bash
# Set this to your installed runtime. For Codex:
FF_RUNTIME="${CODEX_HOME:-$HOME/.codex}/forgeflow"
# For Claude Code, use "$HOME/.claude/forgeflow" instead.
node "$FF_RUNTIME/services/dashboard/server.js"
```

Claude Code also provides `/dashboard`. Start the activity service with `$agent-chat-on` in Codex or `/agent-chat:on` in Claude Code. Install missing service dependencies using the [README setup steps](../../README.md#enable-the-optional-dashboard).

## Know each panel's scope

| Panel | Scope |
|---|---|
| Ember and Live Activity | The activity service's current room |
| Project health and saved evidence | The repository that launched the dashboard |
| Review outcomes | All-time totals for the selected summary project |
| Review trends | All projects; latest 4, 12, or all recorded ISO weeks |

The summary project selector does not change readiness or the current activity room. A reused dashboard retains its launched project. To change that readiness scope, identify the existing service and deliberately restart it from the intended repository.

Refresh data fetches metrics and readiness independently. Failed refreshes retain an existing snapshot and label it stale; an initial failure displays Unavailable. The live connection is independent of those fetches.

## Ember and live activity

Ember follows explicit reports for planning, research, implementation, review, testing, waiting, failure, and completion. It watches, polishes, and dozes when idle. Success is never inferred from elapsed time. Active reports older than 90 seconds show Waiting for an update; disconnection shows Offline.

Animation studio previews change only the local pose and are labeled PREVIEW. Return to live to follow work again. Pause motion and system reduced-motion preferences do not pause incoming activity.

Live Activity displays reported phases and agent messages. It keeps a bounded recent feed, supports filtering, and avoids treating reconnect history as new announcements. If it is empty, check the connection, current room, selected filter, and whether the workflow has reported anything.

## Readiness and missing evidence

The panel reads saved project guidance, context budgets, Lean readiness, host probes, benchmark evidence, failure digests, release readiness, and dogfood reports. Expand Saved project evidence for the individual status cards and checklist.

Missing optional evidence is informational, including unrecorded benchmarks, cross-host probes, release snapshots, or a failure digest before any failure was captured. Watch with zero actionable warnings can mean this optional evidence remains incomplete. Genuine saved blockers and corrupt evidence still require attention.

The next-action button copies a command. Paste it into your assistant when you want to act, then refresh the report after the correction. The dashboard does not execute commands, repair files, call GitHub, or spawn agents on your behalf.

## Review outcomes and trends

Charts require saved verdicts. The default inputs are local metrics under `~/.claude/projects/` and `~/.codex/projects/`; runtime-home and metrics-root overrides are respected.

Codex ForgeFlow review and implementation skills explicitly record actual Arbiter and Compass decisions with saved evidence and stable event IDs. Planning and testing activity do not create approvals. Older unrecorded reviews are not inferred or backfilled. Empty charts before the first recorded review are expected.

## Separate chat view and stopping services

The activity service also serves a chat view at **http://127.0.0.1:4001/** and uses local port `4000` for its other connections. Stop it with `$agent-chat-off` in Codex or `/agent-chat:off` in Claude Code.

Stop a foreground dashboard with Ctrl+C in its terminal. For an automatically started dashboard, identify and stop the verified process listening on `4003`; do not trust an old PID file or terminate an unknown listener. A later eligible workflow entry may start the service again unless automatic startup is disabled.
