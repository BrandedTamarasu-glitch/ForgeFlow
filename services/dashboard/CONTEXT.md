# dashboard — Service Context

## Architecture

Read-only local dashboard. Reads Forgeflow metrics from the JSONL telemetry file and exposes them via a single HTTP server. Uses Node.js built-ins and `ws` for the authenticated live chat relay.

| Attribute | Value |
|---|---|
| Port | 4003 (hardcoded, no env var) |
| Protocol | HTTP and read-only `/api/chat` WebSocket |
| Access | `127.0.0.1` only |
| Data source | `~/.claude/projects/<sanitized-cwd>/memory/forgeflow-metrics.jsonl` and `~/.codex/projects/<sanitized-cwd>/memory/forgeflow-metrics.jsonl` |

The chat panel connects to `/api/chat` on this same origin. The server relays the read-only agent-chat stream from port 4001 using its private session credential, which never reaches browser JavaScript, URLs, or logs. Workflow entry starts or reuses agent-chat; a dashboard started directly can still use `/agent-chat:on` for its live feed.

---

## Files

| File | Purpose |
|---|---|
| `server.js` | HTTP server — routes requests, serves static files, enforces security headers |
| `metrics.js` | Reads and aggregates JSONL telemetry files from one or more runtime roots into the `/api/metrics` response shape |
| `readiness.js` | Reads existing local Forgeflow artifacts into the `/api/readiness` project-readiness response shape |
| `team.js` | Stub — reserved for `/forgeflow-sync` team aggregation in Phase 4C. Currently exports a `readTeamSync` that returns `[]`; not yet imported by `server.js`. |
| `public/index.html` | Semantic dashboard shell; no build step. |
| `public/dashboard.css` | Responsive workshop layout, visual styles, and compact Ember integration. |
| `public/dashboard.js` | Independent metrics/readiness snapshots, scoped summaries/trends, refresh/copy controls, and structured live feed. |

---

## `/api/metrics` Response Shape

This shape is locked. All consumers (dashboard UI, future CI tooling) code against this contract. Do not change field names, remove fields, or reorder top-level keys without a coordinated update to all consumers.

```json
{
  "schema_version": "1",
  "generated_at": "<ISO8601>",
  "window": "all",
  "parse_warnings": 0,
  "projects": [
    {
      "project": "<rootProjectKey>",
      "file_count": 1,
      "event_totals": {
        "verdict": 2,
        "auto-fix-round": 1,
        "command-invoked": 1,
        "finding-overturned": 1,
        "fleet-shard-complete": 0,
        "command-completed": 0,
        "auto-fix-applied": 0
      },
      "verdicts": {
        "arbiter": { "APPROVE": 1, "CONDITIONAL APPROVE": 0, "REVISE": 0, "BLOCK": 0 },
        "compass": { "CONFIRM": 1, "CHALLENGE": 0 }
      },
      "auto_fix": { "rounds": 1, "applied": 0, "applied_failed": 0 }
    }
  ],
  "verdicts": [
    {
      "week": "2024-W01",
      "arbiter": { "APPROVE": 1, "CONDITIONAL APPROVE": 0, "REVISE": 0, "BLOCK": 0 },
      "compass": { "CONFIRM": 1, "CHALLENGE": 0 }
    }
  ]
}
```

### Field Notes

| Field | Description |
|---|---|
| `schema_version` | Always `"1"` (string). |
| `generated_at` | ISO8601 timestamp of when this response was generated. |
| `window` | Currently always `"all"`. Reserved for future time-window filtering. |
| `parse_warnings` | Count of JSONL records that were skipped due to unrecognized `schema_version`. |
| `projects` | Per-project aggregation. One entry per `rootProjectKey`. |
| `project` | The `rootProjectKey` — see dedup rule below. |
| `file_count` | Number of distinct JSONL files that contributed data for this project. |
| `event_totals` | Total count of each event type across all records for this project. |
| `verdicts` (in project) | Per-reviewer verdict counts for this project. |
| `auto_fix` | Aggregated auto-fix stats: total rounds, total applied, total applied_failed. |
| `verdicts` (top-level) | Weekly rollup of verdict counts across all projects, keyed by ISO week string. |

---

## `rootProjectKey` Dedup Rule

Multiple worktrees for the same project produce separate JSONL paths but should be merged into a single project entry. The dedup rule is:

**Key on the filesystem directory name, stripping the worktree suffix:**

```
(--worktrees-.+|-.worktrees-.+)$
```

Two patterns are required: `-.worktrees-` matches the standard `.worktrees` directory after path sanitization (`/` → `-`), and `--worktrees-` matches projects whose CWD already contains a hyphen before the worktrees segment (e.g. `my-app` → `my-app--worktrees-feature`).

Examples:

| Raw directory name | rootProjectKey |
|---|---|
| `Forgeflow` | `Forgeflow` |
| `Forgeflow-.worktrees-feature-x` | `Forgeflow` |
| `my-app-.worktrees-main` | `my-app` |
| `my-app--worktrees-main` | `my-app` |

---

## Security

- **Local origin:** all requests pin Host to the actual loopback listener and reject foreign Origin/Fetch Metadata. The index bootstraps an HttpOnly, SameSite=Strict cookie; chat upgrades require it and an exact same-origin Origin header.
- **Read-only chat:** browser frames are never forwarded upstream. Missing upstream credentials return 503; the UI retains its reconnect/error status. Reload the dashboard after restarting its server to refresh the browser session.
- **Test configuration:** `createServer` accepts `chatPort` and `chatTokenFile` overrides for disposable local regression listeners; production defaults to port 4001 and the shared agent-chat credential location.
- **`cwd` field is NEVER present in any API response.** The `cwd` value from telemetry records is used only internally to resolve file paths. It must not appear in any field of the HTTP response — including nested objects.
- **`/api/readiness` must not expose absolute project artifact paths.** It may include the project basename, card ids, statuses, summaries, and next commands only.
- **Symlink rejection:** The server must refuse to follow symlinks when resolving the JSONL file path. If the resolved path is not identical to the canonical real path, the request is rejected with 403.
- **Response headers:** All API responses must include:
  - `Content-Type: application/json`
  - `X-Content-Type-Options: nosniff`
  - `Cache-Control: no-store`

## `/api/readiness` Response Shape

The readiness endpoint is advisory and read-only. It reads existing local artifacts and the dogfood refresh-plan helper in-process. It does not refresh artifacts, write files, run shell commands, spawn agents, call GitHub, export telemetry, commit, push, or promote automation.

```json
{
  "schema_version": "1",
  "generated_at": "<ISO8601>",
  "project": "<project-basename>",
  "status": "ready|watch|attention",
  "cards": [
    {
      "id": "release-readiness",
      "label": "Release Readiness",
      "status": "ready",
      "summary": "0 blocker(s) in latest saved snapshot.",
      "next": "",
      "details": []
    }
  ],
  "artifacts": {
    "latest_insights": "injected",
    "context_telemetry": "pass",
    "release_readiness": "ready",
    "dogfood_report": "ready",
    "project_operating_model": "present",
    "lean_guidance": "blocked",
    "lean_prime": "blocked",
    "host_verification": "ready",
    "benchmark_evidence": "missing",
    "benchmark_run_ledger": "missing",
    "guidance_aftercare": "current",
    "failure_digest": "missing"
  },
  "lean_prime_steps": [
    {
      "id": "decision",
      "label": "Lean decision evidence",
      "status": "missing",
      "next": "/forgeflow-lean-prime --prime-task \"<work item>\" --write-report",
      "reason": "Record the current work item before relying on context-pack lean guidance."
    }
  ],
  "next": "/forgeflow-dogfood-report --write",
  "boundary": "Dashboard readiness is read-only..."
}
```

## Project Readiness Panel

The UI consumes `/api/readiness` only through `GET`. It renders:

- the overall status as visible text, not color alone
- twelve readiness cards with label, status, summary, next command, and compact details
- a Lean Prime checklist when the API provides `lean_prime_steps`
- host verification and benchmark evidence cards based on local probe and benchmark artifacts
- guidance aftercare status for stale post-commit project guidance
- failure-digest aftercare status for the latest captured validation failure
- one copy-only next-action command when the API provides `next`
- the API boundary text

Controls in this panel must stay read-only. Copying a command to the clipboard is allowed; executing commands, refreshing artifacts, writing files, calling GitHub, spawning agents, or promoting automation from the dashboard is out of scope.

## Chat Proxy Validation
`node --test services/dashboard/__tests__/chat-proxy.test.js` covers authenticated history and live delivery, foreign/missing credential rejection, protected bootstrap, ignored browser commands, and missing upstream credentials on ephemeral loopback ports.

## Ember, the forge companion

`public/ember.js` and `ember.css` render a native SVG robot and forge alongside the project health and next-action panel. Preview controls are disclosed in Animation studio. No image assets, animation packages, external requests, or build step are required. Both assets use exact allowlisted GET routes under the existing local-origin guard.

The chat proxy forwards `init.activity` and `activity` snapshots. Each agent has one latest explicit state in the current chat room. Fresh failures and waiting states take precedence over active work; active work takes precedence over completion. New reports replace an agent's previous state. Reports older than 90 seconds yield to fresh reports. If only old active work remains, Ember says “Waiting for an update”; elapsed time never implies success. Completion/failure stays visible until superseded. Disconnection shows Offline; an empty connected snapshot shows Idle.

Preview buttons affect only the local pose and are visibly labeled PREVIEW. Returning to live uses the latest snapshot. Pause motion persists locally and does not pause activity reception. The SVG is decorative, with a separate text status, polite live region, keyboard controls, and per-agent details. CSS honors `prefers-reduced-motion`; hidden tabs pause animations. Idle rotates through watching, polishing, and dozing.

The panel follows the chat service's current room, independently of the metrics project filter. `npm test` reports testing and its actual final result when the local activity service is available. Workflow entry reports known planning, research, implementation, and review phases through the shared launcher, including Codex skills and bridge-based initialization. Other integrations must explicitly report their phase and result using the agent-chat client or bridge lifecycle API. Ordinary chat messages never infer activity.

Validation: `__tests__/ember.test.js` checks state selection; `tests/e2e/ember.spec.ts` checks preview/live separation, stale/disconnected status, pause, keyboard operation, idle variations, mobile sizing, and reduced motion.

## Automatic opening at workflow entry

`scripts/forgeflow/open-session-dashboard.js` starts or reuses the local dashboard and invokes the OS browser opener once per host session. The existing UserPromptSubmit hook recognizes explicit workflow commands; bridge initialization and Codex workflow skills call the same helper. Starting a host session alone does not open a tab.

The helper uses `FORGEFLOW_SESSION_ID`, `CODEX_THREAD_ID`, or `CLAUDE_SESSION_ID`, or an explicit `--session`. Without a stable id it skips opening. A private, atomic marker under the OS temporary directory deduplicates browser opening across concurrent calls, aliases, and project directories. Each eligible workflow entry independently ensures both services and publishes its known phase, even after the tab has already opened. It records one attempt per session, including failures, to avoid repeated browser prompts; a new session permits another attempt. It does not reopen a tab that the user closes in the same session.

`FORGEFLOW_DASHBOARD_AUTO_OPEN=off` disables both automatic startup and opening. CI, SSH, and Linux without DISPLAY/WAYLAND_DISPLAY skip automatic opening. Browser launch uses `xdg-open` on Linux, `open` on macOS, and `rundll32.exe` on Windows, with argument arrays and a bounded timeout. Startup errors do not block the workflow; manually open http://127.0.0.1:4003/ or start the server to troubleshoot. The helper ensures both the dashboard and agent-chat, checks each service identity, and never reuses an unrecognized listener. Activity startup failure is reported as a warning and does not prevent opening the dashboard. It never reports success just because the browser opened.

`GET /api/health` identifies a healthy dashboard as `{service:"forgeflow-dashboard"}` under the normal local-origin checks. The launcher refuses to launch against an occupied, unrecognized port and never kills an existing listener. An already-running dashboard retains its original project readiness scope; global metrics and chat remain available across projects.

The installer includes the dashboard and agent-chat sources, Ember assets, and dependency manifests in both runtimes. Dependencies must already be installed: run `npm install --prefix <runtime-root>/services/dashboard --ignore-scripts` and `npm install --prefix <runtime-root>/services/agent-chat --ignore-scripts`. Auto-open never installs packages or accesses a package registry.


## Balanced workshop overview

The first view balances compact live Ember and the launched project's health/next action with all-time review outcomes and global weekly trends. The old Drift placeholder is removed. Detailed readiness cards and the Lean Prime checklist remain available through progressive disclosure.

The summary project selector changes only all-time totals, including a separate CONDITIONAL APPROVE total. Readiness stays scoped to the project that launched the server. Trend windows select the latest 4, 12, or all recorded ISO weeks across all projects; they do not promise per-project or exact calendar-day filtering. The chart legend and accessible data table include all four verdict categories.

Refresh data fetches metrics and readiness independently with a 10-second timeout and prevents duplicate in-flight calls. Successful snapshots have separate update times. Failed refresh retains previous data and explicitly marks it stale; an initial failure displays Unavailable. A slow or failed API request does not delay the live WebSocket. No high-frequency file scanning is introduced.

The live feed renders message prose, agent, level, and source timestamp using textContent. It retains at most 100 messages, replaces init history on reconnect, avoids announcing history as new, supports valid message-level filters, and only follows new content when already near the bottom. Browser controls only filter, refresh, expand, copy, or scroll. `/dashboard.js` and `/dashboard.css` join the exact static asset allowlist and installer inventory.

Readiness cards include `severity` (`attention`, `info`, or `ok`) independently of their original evidence status. Optional Lean, host, benchmark, release, failure, and dogfood evidence remains visible without implying an installation failure. Actual error/invalid/fail states still require attention. Context budget uses `estimated_compact_tokens` and `.forgeflow-budget.json` kind limits (default 16,000).

The feed includes current activity on connection and changed activity snapshots as phase rows. Repeated snapshots are deduplicated, history stays bounded, and original frames still drive Ember. Review counts require recorded verdicts; the explicit Codex recorder references saved decisions and deduplicates event IDs.
