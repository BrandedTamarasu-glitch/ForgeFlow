# Context Intelligence

Forgeflow now includes local-only context helpers that reduce token load before agents are spawned. The goal is to give each agent the smallest useful packet of current files, project memory, and scope constraints.

In a repo checkout, examples use `scripts/forgeflow/`. A Claude install from `/update-forgeflow` places the same runtime helpers under:

```text
~/.claude/forgeflow/scripts/forgeflow/
```

## What It Adds

| Capability | Helper | Purpose |
|---|---|---|
| Review context packs | `scripts/forgeflow/build-context-pack.js` | Builds bounded reviewer packets and synthesis input from the current change, including compact topology context for JS/TS changes. |
| Code topology | `scripts/forgeflow/build-code-topology.js` | Builds a static JS/TS import graph with fan-in/fan-out hotspots and changed-file neighbors. |
| Memory index | `scripts/forgeflow/index-memory.js` | Indexes local Forgeflow memory so helpers can find relevant history cheaply. |
| Compact memory context | `scripts/forgeflow/build-memory-context.js` | Produces a concise project-memory summary for research, plan, consult, and implement workflows. |
| Scope manifests | `scripts/forgeflow/build-scope-manifest.js` | Creates implementation scope packets and file ownership hints for agent waves. |
| Context telemetry | `scripts/forgeflow/summarize-context-telemetry.js` | Summarizes estimated baseline, compact, and saved tokens from generated artifacts. |
| Budget checks | `scripts/forgeflow/check-context-budget.js` | Warns or fails when compact context exceeds configured token budgets. |
| Budget seed | `scripts/forgeflow/seed-budget-config.js` | Creates `.forgeflow-budget.json` without overwriting existing config. |
| Health repair | `scripts/forgeflow/health-check.js` | Creates safe project-local Forgeflow state and seeds budget config when requested. |
| Context advisor | `scripts/forgeflow/advise-context.js` | Reports trimming recommendations and previous-run trend deltas. |
| Implementation notes recorder | `scripts/forgeflow/record-implementation-notes.js` | Appends Atlas-consolidated note candidates to the local implementation notes artifact. |
| Implementation notes checker | `scripts/forgeflow/check-implementation-notes.js` | Audits notes structure, sensitive-content patterns, and ship-summary note rendering. |
| Project learnings checker | `scripts/forgeflow/check-project-learnings.js` | Audits project-learning guidance for safety, usefulness, size, freshness, duplicates, and proof-boundary text. |
| Project learning recorder | `scripts/forgeflow/record-project-learning.js` | Appends structured local learning candidates with optional confidence, evidence-count, and application-guidance metadata. |
| Pilot evidence recorder | `scripts/forgeflow/record-pilot-evidence.js` | Creates a local maintainer-pilot evidence note under `.forgeflow/<project-name>/pilot-evidence/`. |
| Pilot evidence rollup | `scripts/forgeflow/rollup-pilot-evidence.js` | Summarizes local pilot evidence notes into support-category counts and a next-action decision. |
| Project learnings rollup | `scripts/forgeflow/rollup-project-learnings.js` | Refreshes durable project guidance from implementation notes, review outcomes, and ship metadata. |
| Project learnings display | `scripts/forgeflow/show-project-learnings.js` | Refreshes project learnings and prints the current-project insight view used by `/forgeflow-learnings --project`. |
| Latest insights packets | `scripts/forgeflow/build-context-pack.js` | Includes the current project-learning insight view in agent packets only after the project-learning quality check passes, and writes a gate report. |

When present, `.forgeflow/<project-name>/implementation-notes.md` is included in the memory index. This lets later consult, implement, review, and ship phases see prior decisions, spec gaps, tradeoffs, deviations, follow-ups, and validation notes without loading the full raw notes file into every prompt.

When JS/TS files are in scope, review context packs also write `code-topology.json`, `code-topology-review-focus.md`, and `code-topology-telemetry.json`, then include a compact **Code Topology** section in each agent packet. The context-pack topology JSON uses changed-neighborhood scope to keep changed files, read-next neighbors, hotspot nodes, and section hints without storing the full repo graph in the review artifact. `synthesis-input.json` and `build-context-pack.js --json` expose a `code_topology_summary`/`code_topology` object with hotspot paths, read-next neighbors, source symbols with line ranges, changed-section hints from diff hunks, and Markdown heading counts. Treat this as static import and section guidance only, not a runtime call graph.

When present, `.forgeflow/<project-name>/project-learnings.md` should be treated as guidance, not proof. Agents may use it to anticipate likely pitfalls and local patterns, but every current finding still needs evidence from current code, tests, and artifacts. If the quality check returns warn or fail, context packs replace the insights with a compact warning and do not inject the guidance. Use `/forgeflow-learnings --project --check` to refresh the artifact and inspect the same gate from the command surface.

## Recommended Flow

For review:

```bash
scripts/forgeflow/build-context-pack.js --json
scripts/forgeflow/build-code-topology.js --json
scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json
scripts/forgeflow/advise-context.js --root .forgeflow --record --json
```

For implementation:

```bash
scripts/forgeflow/build-memory-context.js --json
scripts/forgeflow/build-scope-manifest.js --json
scripts/forgeflow/build-code-topology.js --json
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
    "code-topology": 12000,
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

The advisor also reads `code-topology-telemetry.json` when present. Its output reports topology coverage, source-file and edge counts, unresolved imports, and skipped dynamic imports so teams can spot when topology guidance is missing or when import-graph blind spots are recurring.

## Local-First Behavior

All generated context artifacts stay under `.forgeflow/` by default. The state is local project memory, not hosted telemetry. Keep `.forgeflow/` ignored unless your team intentionally chooses to sync selected artifacts.
