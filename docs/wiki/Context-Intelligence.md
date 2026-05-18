# Context Intelligence

Forgeflow now includes local-only context helpers that reduce token load before agents are spawned. The goal is to give each agent the smallest useful packet of current files, project memory, and scope constraints.

In a repo checkout, examples use `scripts/forgeflow/`. A Claude install from `/update-forgeflow` places the same runtime helpers under:

```text
~/.claude/forgeflow/scripts/forgeflow/
```

## What It Adds

| Capability | Helper | Purpose |
|---|---|---|
| Review context packs | `scripts/forgeflow/build-context-pack.js` | Builds bounded reviewer packets and synthesis input from the current change. |
| Memory index | `scripts/forgeflow/index-memory.js` | Indexes local Forgeflow memory so helpers can find relevant history cheaply. |
| Compact memory context | `scripts/forgeflow/build-memory-context.js` | Produces a concise project-memory summary for research, plan, consult, and implement workflows. |
| Scope manifests | `scripts/forgeflow/build-scope-manifest.js` | Creates implementation scope packets and file ownership hints for agent waves. |
| Context telemetry | `scripts/forgeflow/summarize-context-telemetry.js` | Summarizes estimated baseline, compact, and saved tokens from generated artifacts. |
| Budget checks | `scripts/forgeflow/check-context-budget.js` | Warns or fails when compact context exceeds configured token budgets. |
| Budget seed | `scripts/forgeflow/seed-budget-config.js` | Creates `.forgeflow-budget.json` without overwriting existing config. |
| Health repair | `scripts/forgeflow/health-check.js` | Creates safe project-local Forgeflow state and seeds budget config when requested. |
| Context advisor | `scripts/forgeflow/advise-context.js` | Reports trimming recommendations and previous-run trend deltas. |

## Recommended Flow

For review:

```bash
scripts/forgeflow/build-context-pack.js --json
scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json
scripts/forgeflow/advise-context.js --root .forgeflow --record --json
```

For implementation:

```bash
scripts/forgeflow/build-memory-context.js --json
scripts/forgeflow/build-scope-manifest.js --json
scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json
scripts/forgeflow/advise-context.js --root .forgeflow --record --json
```

For reporting:

```bash
scripts/forgeflow/summarize-context-telemetry.js --root .forgeflow --json
scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json
scripts/forgeflow/advise-context.js --root .forgeflow --record --json
```

## Budget Config

Seed a project-local budget config:

```bash
scripts/forgeflow/seed-budget-config.js --json
```

The default template supports global and per-kind limits:

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

See [Context Budget Examples](Context-Budget-Examples) for review, implementation, strict release-gate, large-diff, low-savings, and trend workflows.

## Health Repair

Run the project-local health helper when a repo is missing Forgeflow state:

```bash
scripts/forgeflow/health-check.js --fix --json
```

It can create:

- `.forgeflow/<project-name>/`
- `.forgeflow/<project-name>/agent-notes/`
- `.forgeflow/` in `.gitignore`
- `.forgeflow-budget.json` when missing

It does not overwrite an existing budget config.

## Trend History

The context advisor records compact history when `--record` is used:

```text
.forgeflow/context-advisor-history.jsonl
```

Each record includes:

- telemetry file count
- estimated compact tokens
- estimated saved tokens
- percent saved
- budget status and violation count
- recommendation actions

The next advisor run compares against the prior record and reports deltas for compact tokens, saved tokens, percent saved, and budget violations.

## Local-First Behavior

All generated context artifacts stay under `.forgeflow/` by default. The state is local project memory, not hosted telemetry. Keep `.forgeflow/` ignored unless your team intentionally chooses to sync selected artifacts.
