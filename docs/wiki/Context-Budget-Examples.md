# Context Budget Examples

Forgeflow context helpers keep agent prompts smaller by building compact packets before agents read files directly. The budget tools help decide when a packet is small enough to use as-is and when to trim or split work.

## Starter Config

Seed the default config:

```bash
scripts/forgeflow/seed-budget-config.js --json
```

Default `.forgeflow-budget.json`:

```json
{
  "max_compact_tokens": 16000,
  "warn_only": true,
  "kind_limits": {
    "context-pack": 16000,
    "memory-context": 8000,
    "scope-manifest": 6000
  }
}
```

Use `warn_only: true` while tuning. Change it to `false` when you want context budgets to fail release checks or CI wrappers.

## Review Workflow

Before `/review`, build review packets and check their budget:

```bash
scripts/forgeflow/build-context-pack.js --json
scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json
scripts/forgeflow/advise-context.js --root .forgeflow --record --json
```

If the advisor reports `context-healthy`, use the generated packet as the primary review context.

If it reports `trim-budget-violation`, trim before spawning agents:

- pass fewer paths to `/review`
- split broad changes into directory-focused reviews
- review generated files separately from source changes
- move long logs, snapshots, or vendored files out of the review scope

## Implementation Workflow

Before `/implement`, build memory and scope artifacts:

```bash
scripts/forgeflow/build-memory-context.js --json
scripts/forgeflow/build-scope-manifest.js --json
scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json
scripts/forgeflow/advise-context.js --root .forgeflow --record
```

If `memory-context` exceeds budget, trim old handoffs, stale design notes, and duplicated plans before asking implementation agents to proceed.

If `scope-manifest` exceeds budget, split the brief into smaller implementation waves and assign narrower file ownership.

## Strict Release Gate

For release checks, switch from warnings to failures:

```json
{
  "max_compact_tokens": 14000,
  "warn_only": false,
  "kind_limits": {
    "context-pack": 14000,
    "memory-context": 7000,
    "scope-manifest": 5000
  }
}
```

Then run:

```bash
scripts/forgeflow/check-context-budget.js --root .forgeflow --json
```

A `fail` status means the generated context should be trimmed before the work is reviewed or shipped.

## Large Diff Example

For a broad change touching multiple subsystems:

```bash
scripts/forgeflow/build-context-pack.js --files changed-files.txt --json
scripts/forgeflow/check-context-budget.js --root .forgeflow --max-kind context-pack=12000 --warn-only
scripts/forgeflow/advise-context.js --root .forgeflow --record
```

If the packet is still large, split `changed-files.txt` by ownership:

```text
changed-backend.txt
changed-frontend.txt
changed-docs.txt
```

Then review each slice separately:

```text
/review changed-backend.txt
/review changed-frontend.txt
```

Docs-only slices often route to `skip-mode` or `thin-mode`, reducing review cost.

## Low-Savings Example

The advisor may report:

```text
WARN: context-pack saved only 12% versus baseline.
Action: Prefer scope packets and compact memory before full artifact reads; remove repeated low-signal sections from generated packets.
```

Typical fixes:

- remove repeated summaries from handoff files
- trim generated output, snapshots, and logs from changed-file lists
- prefer `build-memory-context.js` over asking agents to read full progress logs
- ask for a narrower review path or commit range

## Trend Example

Use `--record` on repeated runs:

```bash
scripts/forgeflow/advise-context.js --root .forgeflow --record
```

The advisor appends:

```text
.forgeflow/context-advisor-history.jsonl
```

On the next run it reports deltas:

```text
Compact token delta: -2400
Saved token delta: 1800
Percent saved delta: 9.5
Budget violation delta: -1
```

That means trimming improved the packet: compact tokens decreased, saved tokens increased, and one violation was removed.
