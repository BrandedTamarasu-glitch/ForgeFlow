# Forgeflow Metrics Telemetry Schema

## Overview

Every Forgeflow event is written as a single JSON line under the active runtime metrics root:

```
~/.claude/projects/<sanitized-cwd>/memory/forgeflow-metrics.jsonl
~/.codex/projects/<sanitized-cwd>/memory/forgeflow-metrics.jsonl
```

where `<sanitized-cwd>` is the full working directory path with `/` replaced by `-`.

**Current schema version:** `"1"`

---

## Top-Level Record Fields

All records share these fields regardless of event type.

| Field | Type | Description |
|-------|------|-------------|
| `schema_version` | `string` | Schema version. Current value: `"1"`. First field in every record. |
| `ts` | `string` | ISO8601 timestamp of when the event was recorded. |
| `session_id` | `string` | Claude session identifier, or `"unknown"` if not available. |
| `project` | `string` | Basename of the working directory at event time. |
| `cwd` | `string` | Full working directory path at event time. |
| `runtime` | `string` | Runtime that recorded the event, usually `"claude-code"` or `"codex"`. Missing on pre-runtime records. |
| `event` | `string` | Event type. One of the 8 values listed in the Event Types section. |
| `command` | `string` | Slash command that triggered this event (e.g. `/review`, `/fleet`). |
| `detail` | `object` | Event-specific payload. Shape varies by `event` — see below. |

---

## Event Types

### 1. `verdict`

Emitted when a reviewer agent produces a final verdict.

```json
{
  "event": "verdict",
  "command": "/review",
  "detail": {
    "reviewer": "<agent name>",
    "verdict": "APPROVE" | "CONDITIONAL APPROVE" | "REVISE" | "BLOCK" | "CONFIRM" | "CHALLENGE"
  }
}
```

| Detail Field | Type | Description |
|---|---|---|
| `reviewer` | `string` | Agent name that issued the verdict (e.g. `"arbiter"`, `"compass"`). |
| `verdict` | `string` | One of the six verdict strings above. Case-normalised to uppercase. |

---

### 2. `auto-fix-round`

Emitted when `/review-auto` completes a fix round, detected via the auto-fix commit message.

```json
{
  "event": "auto-fix-round",
  "command": "/review-auto",
  "detail": {
    "round": 3
  }
}
```

| Detail Field | Type | Description |
|---|---|---|
| `round` | `number` | Round number (integer, 1-based). |

---

### 3. `command-invoked`

Emitted when a Forgeflow slash command is detected as having been called.

```json
{
  "event": "command-invoked",
  "command": "/handoff",
  "detail": {
    "command": "/handoff"
  }
}
```

| Detail Field | Type | Description |
|---|---|---|
| `command` | `string` | The slash command that was invoked. Duplicates the top-level `command` field for query convenience. |

---

### 4. `command-completed`

Emitted when a Forgeflow slash command completes. `verdict` is present only when the command produces one.

```json
{
  "event": "command-completed",
  "command": "/review",
  "detail": {
    "command": "/review",
    "verdict": "APPROVE"
  }
}
```

| Detail Field | Type | Required | Description |
|---|---|---|---|
| `command` | `string` | yes | The slash command that completed. |
| `verdict` | `string` | no | Final verdict string if the command produced one. |

---

### 5. `fleet-shard-complete`

Emitted when a single shard of a `/fleet` run finishes (detected via worktree removal).

```json
{
  "event": "fleet-shard-complete",
  "command": "/fleet",
  "detail": {
    "shard": 2,
    "total": 5,
    "verdict": "APPROVE"
  }
}
```

| Detail Field | Type | Description |
|---|---|---|
| `shard` | `number` | Shard index (1-based integer). |
| `total` | `number` | Total number of shards in this fleet run. |
| `verdict` | `string` | Verdict string for this shard. |

---

### 6. `finding-overturned`

Emitted when Arbiter dismisses a reviewer's finding. Requires Arbiter's output to contain the structured tag line:

```
- REVIEWER: <agent> | CLASS: <class> | FINDING: <brief>
```

under a section header such as `## Overturned Findings`. If Arbiter's output does not emit this tag format, no event fires (fail-open).

```json
{
  "event": "finding-overturned",
  "command": "/review",
  "detail": {
    "overturned_reviewer": "fc",
    "finding_class": "N+1",
    "finding": "orders.map calling db.findUser in a loop"
  }
}
```

| Detail Field | Type | Description |
|---|---|---|
| `overturned_reviewer` | `string` | Agent name whose finding was dismissed. |
| `finding_class` | `string` | Short class label for the finding (e.g. `"N+1"`, `"Missing index"`). |
| `finding` | `string` | Brief description of the finding, truncated to 240 characters. |

---

### 7. `auto-fix-applied`

Emitted once per individual fix attempt to record whether it succeeded or failed.

```json
{
  "event": "auto-fix-applied",
  "command": "/review-auto",
  "detail": {
    "agent": "fc",
    "success": true,
    "reason": "Applied null-check guard"
  }
}
```

| Detail Field | Type | Description |
|---|---|---|
| `agent` | `string` | The agent that produced the fix. |
| `success` | `boolean` | `true` if the fix was applied successfully, `false` if it failed. |
| `reason` | `string` | Optional. Human-readable description of the fix or failure cause. |

---

### 8. `finding-verified`

Emitted when a high-risk finding receives a Aegis decision.

```json
{
  "event": "finding-verified",
  "command": "/review",
  "detail": {
    "reviewer": "warden",
    "verifier": "aegis",
    "finding_class": "auth/session/permissions",
    "decision": "CONFIRMED"
  }
}
```

| Detail Field | Type | Description |
|---|---|---|
| `reviewer` | `string` | Agent whose finding was verified. |
| `verifier` | `string` | Verifier agent name. Current Codex verifier: `"aegis"`. |
| `finding_class` | `string` | Short class label for calibration. |
| `decision` | `string` | One of `"CONFIRMED"`, `"REJECTED"`, or `"BLOCKED"`. |

---

## Schema Version Rules

**Current version:** `"1"` (string, not number).

| Record state | Action |
|---|---|
| Record has no `schema_version` field | Treat as implicit v1. Process normally. |
| `schema_version` is `"1"` | Process normally. |
| `schema_version` is any other value | **Skip the record.** Increment `parse_warnings`. |

### Versioning Policy

- **Additive changes** (new fields on existing event types, new event types): no version bump required. Consumers must tolerate unknown fields.
- **Breaking changes** (renaming a field, removing a field, changing field semantics): requires a bump to `"2"`. All consumers must be updated before the new version is deployed.

---

## Consumers

| Consumer | Description |
|---|---|
| `/forgeflow-metrics` | CLI command that reads the JSONL file and summarises Forgeflow activity. |
| Dashboard `/api/metrics` | HTTP endpoint on port 4003 that serves aggregated metrics to the local dashboard. |
| `summarize-calibration.js` | Local calibration summary for overturned, verified, and auto-fix outcomes. |
| Future CI tooling | Planned integration to surface metrics in CI pipelines. |

---

## Example Record

```json
{
  "schema_version": "1",
  "ts": "2024-01-15T14:32:11.042Z",
  "session_id": "abc123",
  "project": "Forgeflow",
  "cwd": "/home/user/Forgeflow",
  "event": "verdict",
  "command": "/review",
  "detail": { "reviewer": "arbiter", "verdict": "APPROVE" }
}
```
