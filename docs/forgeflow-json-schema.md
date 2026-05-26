# Forgeflow Verdict JSON Schema

Canonical machine-parseable output emitted by `/review --ci` and consumed by `scripts/forgeflow-pr-review.sh`, `/forgeflow-report`, and the Phase 4 dashboard.

The schema is versioned. Breaking changes bump `schema_version`; additive changes do not. CI wrappers MUST reject unknown `schema_version` values rather than guess at forward compatibility.

---

## Emission contract

When `/review` runs with `--ci`, it suppresses the user-facing markdown narrative and emits exactly one JSON block wrapped in sentinel tags at the end of stdout:

```
<forgeflow-verdict-json>
{ ... }
</forgeflow-verdict-json>
```

The wrapper script greps for the sentinel block and extracts the JSON. Anything before the block is log output (safe to discard). Anything after the block is forbidden — the block must be the last payload.

If `/review` cannot produce a verdict (classifier skip-mode, pre-flight failure, budget exceeded), it still emits a JSON block with `verdict: "SKIPPED"` or `verdict: "ABORTED"` and a `reason` field. The wrapper never needs to parse human-readable text.

---

## Schema (v1)

```json
{
  "schema_version": "1",
  "verdict": "APPROVE | CONDITIONAL_APPROVE | REVISE | BLOCK | SKIPPED | ABORTED",
  "summary": "1-2 sentence human-readable synthesis of the verdict",
  "routing_mode": "skip-mode | thin-mode | full-mode | deep-mode",
  "routing_override": null,
  "arbiter": {
    "verdict": "APPROVE | CONDITIONAL_APPROVE | REVISE | BLOCK",
    "summary": "Arbiter's 1-sentence verdict summary"
  },
  "compass": {
    "verdict": "CONFIRM | CHALLENGE",
    "summary": "Compass's 1-sentence verdict summary",
    "tests_run": true,
    "tests_passed": 12,
    "tests_failed": 0,
    "ci_skipped_reason": null
  },
  "findings": {
    "blockers": [
      {
        "id": "B1",
        "title": "Short title",
        "detail": "Full explanation",
        "file": "src/auth/passport.ts",
        "line": 42,
        "raised_by": "warden | smith | lumen | atlas | arbiter | compass",
        "class": "null-safety | sql-injection | schema-mismatch | ...",
        "severity": "blocker"
      }
    ],
    "must_fix": [ ... same shape, severity: "must-fix" ... ],
    "recommended": [ ... severity: "recommended" ... ],
    "nits": [ ... severity: "nit" ... ],
    "boyscout": [ ... severity: "boyscout" ... ]
  },
  "overturned_findings": [
    {
      "reviewer": "smith",
      "class": "n-plus-one",
      "finding": "loop iterates fixed batches, not per-record"
    }
  ],
  "chunking": {
    "chunked": false,
    "chunks": [],
    "strategy": null
  },
  "files_reviewed": [
    "src/auth/passport.ts",
    "src/db/migrations/20260419-add-session.sql"
  ],
  "metadata": {
    "schema_version": "1",
    "timestamp_utc": "2026-04-19T14:32:01Z",
    "session_id": "abcd1234-5678-ef90-1234-567890abcdef",
    "project": "Forgeflow",
    "branch": "main",
    "commit_sha": "83cb720",
    "pr_number": 42,
    "file_count": 7,
    "lines_changed": 384,
    "tracked_lines": 344,
    "untracked_lines": 40,
    "duration_seconds": 127,
    "cost_estimate_usd": 0.42,
    "parse_warnings": [],
    "push_error": null
  },
  "reason": null
}
```

---

## Field reference

### Top-level

| Field | Type | Required | Notes |
|---|---|---|---|
| `schema_version` | string | yes | Always `"1"` in this release |
| `verdict` | enum | yes | Final combined verdict |
| `summary` | string | yes | Short synthesis; for PR comment header |
| `routing_mode` | enum | yes | Which mode the Step 0.5 classifier picked |
| `routing_override` | string \| null | yes | Populated when `--mode` overrode the classifier, else null |
| `arbiter` | object | when verdict ≠ SKIPPED | Arbiter's technical verdict |
| `compass` | object | when verdict ∉ {SKIPPED, ABORTED} | Compass runs in thin, full, and deep modes — she always follows Arbiter. Only a full classifier skip or pre-flight abort omits her |
| `findings` | object | yes | Always present; arrays may be empty |
| `overturned_findings` | array | yes | Empty when Arbiter overturned nothing |
| `chunking` | object | yes | `chunked: false` when diff ≤ 30 files |
| `files_reviewed` | array | yes | Paths relative to repo root |
| `metadata` | object | yes | Audit + cost tracking |
| `reason` | string \| null | yes | Populated on SKIPPED or ABORTED, else null |

### `verdict` enumeration

| Value | When | CI exit code |
|---|---|---|
| `APPROVE` | Arbiter APPROVE + Compass CONFIRM (or Compass not required) | 0 |
| `CONDITIONAL_APPROVE` | Arbiter CONDITIONAL APPROVE with open blocked findings | 0 |
| `REVISE` | Arbiter REVISE OR Compass CHALLENGE | 1 |
| `BLOCK` | Arbiter BLOCK | 1 |
| `SKIPPED` | Classifier skip-mode, or no files to review | 0 |
| `ABORTED` | Pre-flight failed, budget exceeded, or auth failure | 2 |

### `findings.<tier>[]`

Each finding entry:

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Stable within a review run: `B1`, `M1`, `R1`, `N1`, `BS1` |
| `title` | string | yes | ≤ 80 chars |
| `detail` | string | yes | Full reasoning; may include code excerpts |
| `file` | string \| null | yes | null when the finding is cross-cutting |
| `line` | integer \| null | yes | null when finding is not line-specific |
| `raised_by` | enum | yes | Agent name lowercased |
| `class` | string \| null | yes | Same tag vocabulary as `overturned_findings.class`. Null when the orchestrator could not extract a recognizable class tag from the reviewer's output. Consumers MUST handle null — never assume the tag is set |
| `severity` | enum | yes | Matches tier name (blocker / must-fix / recommended / nit / boyscout) |

### `overturned_findings[]`

Emitted only when the routing mode includes Arbiter synthesis (thin / full / deep). Extracted from Arbiter's `## Overturned Findings (telemetry)` section per the tag format in `agents/arbiter-review.md`. Empty when Arbiter overturned nothing.

### `chunking`

```json
{
  "chunked": true,
  "strategy": "monorepo | path-segment",
  "chunks": [
    {
      "label": "workspace-api",
      "file_count": 18,
      "routing_mode": "full-mode",
      "verdict": "APPROVE"
    }
  ]
}
```

`chunked: false` implies `chunks: []` and `strategy: null`.

### `metadata.cost_estimate_usd`

Rough estimate from per-mode token projections × current model rates. Not authoritative — real billing shows in the Anthropic console. Accuracy target: within ±30%. The wrapper uses this to detect budget overruns before the review starts, not after.

### `metadata.lines_changed`, `metadata.tracked_lines`, and `metadata.untracked_lines`

`lines_changed` is the classifier total used for routing. `tracked_lines` and `untracked_lines` explain the source of that total when available. Consumers must handle null source fields because older route helpers and explicit file lists may only provide the total.

### `metadata.parse_warnings`

Array of strings. Empty when finding parsing produced no issues. Populated when Arbiter's review output lacked the expected structure (free-form prose instead of bulleted items under a tier section, or a section heading was absent). Consumers should treat a non-empty `parse_warnings` array as a signal that the `findings` data may be incomplete — the verdict field is still authoritative.

---

## SKIPPED / ABORTED envelope

When the review cannot complete, most fields are still emitted with null / empty values; only `verdict`, `reason`, and `metadata` carry information:

```json
{
  "schema_version": "1",
  "verdict": "SKIPPED",
  "summary": "Diff classified as docs-only (2 files, 47 lines). Skipping Forgeflow.",
  "routing_mode": "skip-mode",
  "routing_override": null,
  "arbiter": null,
  "compass": null,
  "findings": { "blockers": [], "must_fix": [], "recommended": [], "nits": [], "boyscout": [] },
  "overturned_findings": [],
  "chunking": { "chunked": false, "chunks": [], "strategy": null },
  "files_reviewed": ["README.md", "docs/CONTRIBUTING.md"],
  "metadata": { ... },
  "reason": "classifier-skip-mode"
}
```

**`files_reviewed` contract in SKIPPED/ABORTED:** Populated when the classifier resolved a file list (e.g., skip-mode after file discovery). Empty array otherwise (e.g., `preflight-typecheck-failed` where resolution never happened). `metadata.file_count` always mirrors `files_reviewed.length`. Consumers can iterate the array without null checks — the field is always an array.

**Additive metadata keys** (`parse_warnings`, `push_error`) are always emitted as `[]` or `null` respectively — never absent. Consumers can rely on their presence across all verdict values including SKIPPED and ABORTED.

`reason` vocabulary (fixed string enum):

| Reason | Context |
|---|---|
| `classifier-skip-mode` | Step 0.5 returned skip-mode |
| `no-files-changed` | Step 1 found no files to review |
| `preflight-typecheck-failed` | Step 0c typecheck returned non-zero |
| `preflight-lint-failed` | Step 0c lint returned non-zero |
| `preflight-branch-mismatch` | Step 0b PR branch mismatch |
| `budget-exceeded` | Cost estimate > `.github/forgeflow-budget.yml` threshold |
| `auth-missing` | No ANTHROPIC_API_KEY or OAuth token in environment |
| `classifier-error` | Unexpected classifier failure |

---

## Consumer contract

Wrappers and tools consuming this schema MUST:

1. Reject unknown `schema_version`. Do not attempt forward-compat guesses.
2. Treat absent optional fields as null, not errors.
3. Preserve `id` strings when re-emitting findings (e.g., in PR comments). IDs are stable handles for humans replying to specific findings.
4. Never mutate the JSON emitted by `/review --ci`. Parse → transform → emit a new object for downstream stages.

Wrappers MAY:

- Filter findings by severity before posting a PR comment (e.g., drop `nits` in comment but keep in full artifact)
- Re-map `class` tags to human-friendly labels for display
- Augment metadata with CI-system fields (workflow run URL, actor, etc.) in a sibling `ci_metadata` object — never under `metadata`

---

## /review-auto augmented fields

`/review-auto --ci` emits the same schema plus five auto-fix-specific keys:

```json
{
  "auto_fix_applied": true,
  "auto_fix_rounds": 2,
  "auto_fix_items_applied": 7,
  "auto_fix_items_skipped": 3,
  "auto_fix_commits": ["abc1234", "def5678"],
  "auto_fix_status": "success | cap-reached | aborted-unsafe | push-failed"
}
```

Consumers inspecting a verdict from `/review-auto` MUST check `auto_fix_applied` before interpreting other fields. When `false`, the Forgeflow team made no changes and `findings` reflects the original (un-fixed) state. When `true`, `findings` reflects the post-fix re-review.

The standard `metadata` object also gains `push_error: string | null` — populated when `auto_fix_status == "push-failed"`, null otherwise.

The same `schema_version: "1"` covers both `/review --ci` and `/review-auto --ci` outputs. Consumers distinguish by the presence of the `auto_fix_*` keys.

## Local artifact contracts

These local helper artifacts also use additive `schema_version: "1"` contracts. They are local operational artifacts, not public-safe reports unless a helper explicitly says it redacts for public sharing.

### Project intelligence rollup

Produced by `scripts/forgeflow/build-project-intelligence.js --json` at `.forgeflow/<project>/context/project-intelligence-rollup.json`.

Required top-level fields:

- `schema_version: "1"`
- `generated_at`
- `project_dir`
- `provenance.git`
- `trust_state`
- `readiness`
- `freshness`
- `guidance`
- `top_risks`
- `hot_files`
- `recommended_next_actions`
- `validation_patterns`
- `agent_feedback`
- `review_outcomes`
- `review_prep`
- `next_work_brief`
- `next_work_items`
- `recommendations`
- `artifacts`

`readiness.state` is one of `ready`, `needs-refresh`, `needs-triage`, or `blocked`. `next_work_items[]` entries include `title`, `priority`, `source`, `why`, `start_with[]`, `validate_with[]`, and `proof_boundary`.

`review_outcomes` contains aggregate counts only: `status`, `records`, `invalid_lines`, `learning_signals`, `totals`, and `top_classes`. It does not copy raw review notes or finding detail.

### Review outcome summary

Produced by `scripts/forgeflow/record-review-outcome.js --summary <jsonl> --json`.

Required top-level fields:

- `schema_version: "1"`
- `records`
- `modes`
- `agents`
- `totals`
- `learning_signals`
- `classes`

`learning_signals` always includes `true_positive`, `false_positive`, `missed_issue`, `stale_guidance`, and `manual_promotion_candidate`. The first three are derived from confirmed findings, rejected findings, and post-merge regressions. Manual input may only supply `stale_guidance` and `manual_promotion_candidate`.

### Release readiness

Produced by `scripts/forgeflow/render-release-readiness.js --json`.

Required top-level fields:

- `schema_version: "1"`
- `generated_at`
- `root`
- `status`
- `mode`
- `command_count`
- `install_preflight`
- `categories`
- `blockers`
- `checks`
- `snapshot`
- `comparison`
- `boundary`

`mode` is `plan-only` or `run`. `status` is `planned`, `ready`, or `blocked`. `comparison.status` is `no-baseline`, `unchanged`, `changed`, or `regressed`.

### Version support snapshot

Produced by `scripts/forgeflow/forgeflow-version.js --snapshot --json` and saved at `~/.claude/forgeflow/version-snapshot.json`.

Required top-level fields:

- `schema_version: "1"`
- `repo`
- `home`
- `installed`
- `upstream`
- `paths`
- `path_status`
- `runtime_helpers`
- `snapshot`
- `status`
- `action`

When the helper is run offline, `upstream.status` is `skipped-offline`. The snapshot may include local filesystem paths and should be treated as local support data.

## Schema evolution

Additive changes that do not break existing consumers do not bump `schema_version`:
- New optional fields on existing objects
- New values in open enums (`class`, `reason` when documented)
- New tiers in `findings`

Breaking changes bump to v2:
- Renaming fields
- Removing fields
- Changing field types
- Tightening enum values that were previously open

Consumers pin to `schema_version: "1"` until they explicitly add v2 support.
