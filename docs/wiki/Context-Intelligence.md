# Context Intelligence

Forgeflow now includes local-only context helpers that reduce token load before agents are spawned. The goal is to give each agent the smallest useful packet of current files, project memory, and scope constraints.

In a repo checkout, examples use `scripts/forgeflow/`. A Claude install from `/update-forgeflow` places the same runtime helpers under:

```text
~/.claude/forgeflow/scripts/forgeflow/
```

## What It Adds

| Capability | Helper | Purpose |
|---|---|---|
| Review context packs | `scripts/forgeflow/build-context-pack.js` | Builds bounded reviewer packets and synthesis input from the current change, including latest insights, latest failure-digest context when present, and compact topology-guided review focus for JS/TS changes. Pass `--root <repo>` when the helper is launched from outside the target checkout. |
| Code topology | `scripts/forgeflow/build-code-topology.js` | Builds a static JS/TS import graph with fan-in/fan-out hotspots, changed-file neighbors, topology-guided review focus, and import-gap details for unresolved or dynamic imports. It resolves relative imports, source-suffix modules, extensionless TSX re-exports, tsconfig/jsconfig path aliases, common `@/` and `~/` src aliases, and literal dynamic imports when the target source file exists. |
| Memory index | `scripts/forgeflow/index-memory.js` | Indexes local Forgeflow memory so helpers can find relevant history cheaply. |
| Compact memory context | `scripts/forgeflow/build-memory-context.js` | Produces a concise project-memory summary for research, plan, consult, and implement workflows. |
| Scope manifests | `scripts/forgeflow/build-scope-manifest.js` | Creates implementation scope packets and file ownership hints for agent waves. |
| Context telemetry | `scripts/forgeflow/summarize-context-telemetry.js` | Summarizes estimated baseline, compact, and saved tokens from generated artifacts. |
| Budget checks | `scripts/forgeflow/check-context-budget.js` | Warns or fails when compact context exceeds configured token budgets. |
| Budget seed | `scripts/forgeflow/seed-budget-config.js` | Creates `.forgeflow-budget.json` without overwriting existing config. |
| Local artifact safety | `scripts/forgeflow/file-safety.js` | Refuses symlinked memory inputs and symlinked output destinations before context, memory, or learning helpers read or write local artifacts. |
| Health repair | `scripts/forgeflow/health-check.js` | Creates safe project-local Forgeflow state and seeds budget config when requested. |
| Context advisor | `scripts/forgeflow/advise-context.js` | Reports trimming recommendations and previous-run trend deltas, preferring canonical `context/latest` telemetry when the same artifact also exists in the project context root. |
| Agent drift | `scripts/forgeflow/check-agent-drift.js` | Compares agent prompts against canonical shared intelligence sections, with mode-specific Arbiter expectations and adapted sections treated as informational. |
| Implementation notes recorder | `scripts/forgeflow/record-implementation-notes.js` | Appends Atlas-consolidated note candidates to the local implementation notes artifact. |
| Implementation notes checker | `scripts/forgeflow/check-implementation-notes.js` | Audits notes structure, sensitive-content patterns, and ship-summary note rendering. |
| Project learnings checker | `scripts/forgeflow/check-project-learnings.js` | Audits project-learning guidance for safety, usefulness, size, freshness, duplicates, and proof-boundary text. |
| Project learning recorder | `scripts/forgeflow/record-project-learning.js` | Appends structured local learning candidates with optional confidence, evidence-count, application-guidance, and lifecycle metadata. |
| Pilot evidence recorder | `scripts/forgeflow/record-pilot-evidence.js` | Creates a local maintainer-pilot evidence note under `.forgeflow/<project-name>/pilot-evidence/`. |
| Pattern learnings rollup | `scripts/forgeflow/rollup-pattern-learnings.js` | Scans cross-project learnings and project-learning candidates, clusters known/candidate patterns with source-mix labels, and records pattern-log freshness for reports. |
| Pilot evidence rollup | `scripts/forgeflow/rollup-pilot-evidence.js` | Summarizes local pilot evidence notes into support-category counts and a next-action decision. |
| Project learnings rollup | `scripts/forgeflow/rollup-project-learnings.js` | Refreshes durable project guidance from implementation notes, review outcomes, and ship metadata. |
| Project learnings display | `scripts/forgeflow/show-project-learnings.js` | Refreshes project learnings, optionally runs the quality gate and context-pack smoke, and prints the current-project insight view used by `/forgeflow-learnings --project`. |
| Latest insights packets | `scripts/forgeflow/build-context-pack.js` | Includes the current project-learning insight view in agent packets only after the project-learning quality check passes, and writes a gate report. |
| Latest insights state | `scripts/forgeflow/latest-insights-state.js` | Provides the shared readiness/freshness check used by health, report, and trends. |
| Project code map | `scripts/forgeflow/show-code-map.js` | Renders a compact maintainer-facing map from topology, hotspots, sections, changed sections, import gaps, provenance, trend deltas, and artifact paths. |
| Resolved edge summary | `scripts/forgeflow/show-code-map.js` | Shows relative, alias, literal dynamic, source-suffix, and JS/JSX compatibility edge counts, plus compact alias and dynamic examples so users can explain topology edge-count changes. |
| Import-gap triage | `scripts/forgeflow/show-code-map.js` | Groups import gaps into likely expected gaps versus gaps needing review, with categories for assets/data, non-literal dynamic imports, source suffix resolution, aliases, local missing modules, and test fixtures. |
| Safe command-output reduction | `scripts/forgeflow/compact-command-output.js` | Compacts allowlisted human-narrative output only. Diffs, patches, SHAs, exact file lists, and unsafe command output pass through raw with an explicit reason. |
| Failure digest | `scripts/forgeflow/build-failure-digest.js` | Writes a compact failure digest with Git provenance, raw-required status, omitted-line counts, detected file/line references, and compact output. |
| Noisy command advisor | `scripts/forgeflow/advise-noisy-command.js` | Suggests narrower invocations for noisy commands such as unbounded `find`, recursive listings, broad test runs, and broad build/typecheck output. |
| Project trends | `scripts/forgeflow/show-project-trends.js` | Summarizes code-map trend status, import-gap status, artifact freshness, latest-insights readiness/freshness, latest failure-digest provenance/freshness, project-learning consumption, and advisor health from existing local artifacts, with optional `--refresh` first and a direct refresh recommendation when stale. |
| Project intelligence rollup | `scripts/forgeflow/build-project-intelligence.js` | Writes `.forgeflow/<project-name>/context/project-intelligence-rollup.{json,md}` with trust state, freshness, Git provenance, top risks, hot files, validation patterns, recommended next actions, and review-prep guidance from trends and project learnings. |
| Forgeflow report | `scripts/forgeflow/render-forgeflow-report.js` | Combines local telemetry, false-positive thresholds, pattern-log freshness, context savings, project trends, import-gap status, latest-insights readiness/freshness, latest failure-digest status/freshness, and direct next-action recommendations into one report, with optional `--refresh` first. |
| Smoke check | `scripts/forgeflow/smoke-check.js` | Defaults to downstream readiness checks for health, trends refresh, report refresh, and code map. Warn/fail checks include reason, evidence, clearing guidance, and next actions in JSON and Markdown. Use `--mode source` for source-tree release guards plus packaged and installed-runtime dogfood self-tests, or `--mode full` for both groups. |
| Pilot script | `scripts/forgeflow/render-pilot-script.js` | Prints the default bounded maintainer trial script or a first-real-task new-user path with `--path new-user`, plus a public-safe result template that connects smoke, report, code-map, evidence recording, and pilot rollup. |

When present, `.forgeflow/<project-name>/implementation-notes.md` is included in the memory index. This lets later consult, implement, review, and ship phases see prior decisions, spec gaps, tradeoffs, deviations, follow-ups, and validation notes without loading the full raw notes file into every prompt.

Context helpers treat `.forgeflow/` as local state but still guard it: memory indexing and fallback memory reads refuse symlinked sources, predictable output files refuse symlinked destinations, and context/scope summaries include untracked files so newly created work is visible to reviewers. In CI mode, context-pack generation fails predictably when generated telemetry exceeds the configured context budget instead of silently handing out an over-budget packet.

Review context packs include a compact **Project Code Map** section when `.forgeflow/<project-name>/context/project-code-map.md` or `code-topology.json` exists. This gives agents project-level hotspot and section guidance even when the current change is not a JS/TS diff.

When JS/TS files are in scope, review context packs also write `code-topology.json`, `code-topology-review-focus.md`, and `code-topology-telemetry.json`, then include a compact **Code Topology** section in each agent packet. The context-pack topology JSON uses changed-neighborhood scope to keep changed files, read-next neighbors, topology-guided focus hints, hotspot nodes, import-gap examples, section hints, and Git provenance without storing the full repo graph in the review artifact. Code-map refreshes retain compact snapshots in `.forgeflow/<project-name>/context/code-map-history.jsonl`, allowing the map to report previous-run deltas such as new hotspots, unresolved import changes, and changed-section churn. Import gaps are still shown when they come from fixtures or tests, but trends/report/smoke only escalate production-scope gaps. If `.forgeflow/<project-name>/context/latest/failure-digest.md` exists, context packets include a compact **Latest Failure Digest** section and `synthesis-input.json` links its freshness metadata so agents can start from the last summarized failure without rereading large logs, while seeing when the digest is stale for the current checkout. `synthesis-input.json` and `build-context-pack.js --json` expose a `code_topology_summary`/`code_topology` object with hotspot paths, read-next neighbors, topology-guided review focus, provenance, and history metadata for the current review surface. Treat all topology/code-map content as static import and section guidance only, not a runtime call graph.

When present, `.forgeflow/<project-name>/project-learnings.md` should be treated as guidance, not proof. Agents may use it to anticipate likely pitfalls and local patterns, but every current finding still needs evidence from current code, tests, and artifacts. The project-learning display helper refreshes the current checkout's compact code topology before rollup, so structural hotspots, changed-section files, and code-map trend deltas can become Hot Files And Modules, Risk Areas, and next-work guidance without relying on stale topology. If the quality check returns warn or fail, context packs replace the insights with a compact warning and do not inject the guidance. Use `/forgeflow-learnings --project --check` to refresh the artifact, run the quality gate, smoke-test context-pack injection, and inspect the same gate from the command surface.

## Recommended Flow

For review:

```bash
scripts/forgeflow/build-context-pack.js --root . --json
scripts/forgeflow/check-agent-drift.js --json
scripts/forgeflow/build-code-topology.js --json
scripts/forgeflow/show-code-map.js --json
scripts/forgeflow/render-forgeflow-report.js --no-drift --json
scripts/forgeflow/smoke-check.js --json
scripts/forgeflow/smoke-check.js --mode source --json
scripts/forgeflow/render-pilot-script.js --runtime codex
scripts/forgeflow/rollup-pattern-learnings.js --dry-run --json
scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json
scripts/forgeflow/advise-context.js --root .forgeflow --record --json
```

For implementation:

```bash
scripts/forgeflow/build-memory-context.js --json
scripts/forgeflow/build-scope-manifest.js --json
scripts/forgeflow/build-code-topology.js --json
scripts/forgeflow/show-code-map.js --json
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

The advisor also scans code-map history files under `.forgeflow/<project-name>/context/code-map-history.jsonl`. When at least two snapshots exist, it reports compared code-map trend deltas, including new hotspots, unresolved import growth, and changed-section churn.

The next advisor run compares against the prior record and reports deltas for compact tokens, saved tokens, percent saved, and budget violations.

The advisor also reads `code-topology-telemetry.json` when present. Its output reports topology coverage, source-file and edge counts, unresolved imports, and skipped dynamic imports so teams can spot when topology guidance is missing or when import-graph blind spots are recurring.

## Local-First Behavior

All generated context artifacts stay under `.forgeflow/` by default. The state is local project memory, not hosted telemetry. Keep `.forgeflow/` ignored unless your team intentionally chooses to sync selected artifacts.
