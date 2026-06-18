# dashboard — Service Context

## Architecture

Read-only local dashboard. Reads Forgeflow metrics from the JSONL telemetry file and exposes them via a single HTTP server. Zero npm runtime dependencies — standard Node.js built-ins only.

| Attribute | Value |
|---|---|
| Port | 4003 (hardcoded, no env var) |
| Protocol | HTTP only — no WebSocket |
| Access | `127.0.0.1` only |
| Data source | `~/.claude/projects/<sanitized-cwd>/memory/forgeflow-metrics.jsonl` and `~/.codex/projects/<sanitized-cwd>/memory/forgeflow-metrics.jsonl` |

The chat panel in the dashboard UI connects to port 4001 (agent-chat), not this server.

---

## Files

| File | Purpose |
|---|---|
| `server.js` | HTTP server — routes requests, serves static files, enforces security headers |
| `metrics.js` | Reads and aggregates JSONL telemetry files from one or more runtime roots into the `/api/metrics` response shape |
| `readiness.js` | Reads existing local Forgeflow artifacts into the `/api/readiness` project-readiness response shape |
| `team.js` | Stub — reserved for `/forgeflow-sync` team aggregation in Phase 4C. Currently exports a `readTeamSync` that returns `[]`; not yet imported by `server.js`. |
| `public/index.html` | Dashboard UI — single-page, no build step required. Renders `/api/metrics` trends and the read-only `/api/readiness` Project Readiness panel. |

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
