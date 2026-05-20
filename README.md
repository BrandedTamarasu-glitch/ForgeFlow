# Forgeflow

Forgeflow is an end-to-end AI software delivery workflow for Claude Code and Codex. It turns a prompt or code change into a structured build cycle: discuss, research, plan, consult, implement, review, and ship.

Instead of one general-purpose assistant doing everything, Forgeflow uses a focused cast of agents with clear responsibilities, evidence standards, and handoff rules.

## Why Forgeflow

Most AI coding workflows collapse three different jobs into one prompt: deciding what to build, writing the code, and judging whether the result is safe to ship. Forgeflow separates those jobs.

- **Plan before coding:** discussion, research, and planning phases preserve product intent.
- **Use specialists where they help:** backend craft, security, UX, coordination, architecture, validation, and verification each get their own agent.
- **Keep verdicts grounded:** high-risk findings can pass through Aegis, an evidence-only verifier.
- **Explain routing decisions:** review mode records why agents were included or skipped.
- **Carry implementation context forward:** `/implement` maintains local implementation notes for decisions, spec gaps, tradeoffs, deviations, follow-ups, and validation notes, then `/ship` checks and summarizes them.
- **Learn from the project itself:** project learnings summarize recurring pitfalls, stable decisions, risk areas, validation patterns, hot files, and recommended approaches across work items.
- **Learn locally:** calibration and outcome records stay on your machine unless you choose to share them.
- **Pilot with evidence:** local pilot helpers capture maintainer-trial notes, roll up repeated support categories, and surface the latest rollup in health output.

If you are coming from Review Squad or ad hoc agent review, Forgeflow keeps specialist review agents but adds the workflow around them: lifecycle commands, Codex-native agents and skills, install health checks, repair and rollback, local context budgets, release checks, and evaluation reports. See [Why Forgeflow](docs/wiki/Why-Forgeflow.md) for the short positioning.

## The Agents

| Agent | Focus | Typical Work |
|---|---|---|
| **Smith** | backend craft, data, code quality | schema, migrations, business logic, maintainability, naming, decomposition |
| **Warden** | security, systems, reuse | auth, validation, integration boundaries, threat models, efficient reuse |
| **Lumen** | UX, accessibility, connectivity | visual polish, interaction states, accessibility, frontend performance, service paths |
| **Atlas** | coordination and memory | scope tracking, project memory, handoffs, cross-agent risks |
| **Arbiter** | architecture synthesis | implementation briefs, conflict resolution, final technical verdicts |
| **Compass** | product validation | requirements, plan adherence, tests, UX intent, final validation |
| **Aegis** | neutral verification | confirms or rejects high-risk findings from visible evidence only |

## Core Workflow

```text
/discuss -> /research -> /plan -> /consult -> /implement -> /review -> /ship
```

You can also enter at the point you need:

- `/consult` for an implementation brief before coding.
- `/implement` to execute a prepared brief and maintain `.forgeflow/<project>/implementation-notes.md`.
- `/review` for a multi-agent review of a branch, diff, or file list.
- `/review-auto` to apply conservative safe fixes and re-review.
- `/audit` for a deeper system/security/craft pass.
- `/quick` for small targeted tasks.

Codex users can use the matching skills:

```text
$discuss -> $research -> $plan -> $consult -> $implement -> $forge-review -> $ship
```

## Quick Start

Clone the repository:

```bash
git clone https://github.com/BrandedTamarasu-glitch/ForgeFlow.git
cd ForgeFlow
```

From Claude Code, install or update the Forgeflow command and helper bundle:

```text
/update-forgeflow
```

That syncs agents, commands, hooks, templates, project rules, patterns, and runtime helpers into `~/.claude/`. The installer is script-backed, pins the installed version to the fetched commit SHA, and can be re-run safely when a new release is available.

Expected result:

```text
Forgeflow installed  (<commit>)
Runtime helpers: ~/.claude/forgeflow/scripts/forgeflow/
```

Runtime helpers are installed at:

```text
~/.claude/forgeflow/scripts/forgeflow/
```

For terminal commands below, use the repo-local helper path when working from a checkout, or the installed helper root when using the no-clone Claude install:

```bash
HELPER_ROOT="scripts/forgeflow"
if [ ! -x "${HELPER_ROOT}/ensure-forgeflow-state.sh" ]; then
  HELPER_ROOT="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
```

Bootstrap and verify project-local state:

```bash
${HELPER_ROOT}/ensure-forgeflow-state.sh
${HELPER_ROOT}/health-check.js --fix --json
```

Expected health-check result:

```json
{"status":"pass"}
```

Seed a project-local context budget config without overwriting an existing file:

```bash
${HELPER_ROOT}/seed-budget-config.js --json
```

To inspect local context savings and get trimming recommendations:

```bash
${HELPER_ROOT}/advise-context.js --root .forgeflow --record --json
```

Run a first review from Claude Code:

```text
/review
```

Or start the full delivery workflow:

```text
/discuss
/research
/plan
/consult
/implement
/review
/ship
```

Codex users can run the same workflow through skills:

```text
$discuss frame the feature
$research evaluate options
$plan create the implementation plan
$consult produce the implementation brief
$implement execute the brief
$forge-review review the current changes
$ship prepare the branch
```

Forgeflow stores local workflow memory in:

```text
.forgeflow/<project-name>/
```

That directory is ignored by git by default.

## What Is Included

- Claude command files in `commands/`
- Claude agent files in `agents/`
- Codex agents in `.codex/agents/`
- Codex skills in `.agents/skills/`
- routing, telemetry, and shipping helpers in `scripts/forgeflow/`
- local dashboard and chat services in `services/`
- calibration, route, and verification fixtures in `fixtures/`
- product and schema docs in `docs/`

## Review Routing

Forgeflow review mode classifies a change before spawning agents:

- **skip-mode:** docs-only or no code surface
- **thin-mode:** small/test-only/low-risk changes
- **full-mode:** standard multi-agent coverage
- **deep-mode:** auth, security, migrations, schemas, permissions, crypto, or broad high-risk surfaces

Routing is deterministic and explainable. When calibration data exists, Forgeflow can add telemetry hints, require Aegis for historically noisy classes, or expand specialist coverage for high-value paths.

Route JSON reports total changed lines plus tracked and untracked line sources, which makes review escalation easier to audit when a branch includes newly created files.

## Local Metrics And Calibration

Forgeflow can summarize local review telemetry:

```bash
scripts/forgeflow/summarize-calibration.js --json
scripts/forgeflow/record-review-outcome.js --summary .forgeflow/<project>/review-outcomes.jsonl --json
```

These records are local-first. They are meant to help you understand false positives, verifier outcomes, accepted findings, review time, and auto-fix quality.

## Local Context Intelligence

Forgeflow includes local-only helpers that reduce agent prompt load before review or implementation work starts:

- **Context packs:** `build-context-pack.js` prepares bounded reviewer packets and a synthesis input file from the changed files, including latest insights, compact project code-map guidance, changed-neighborhood topology context, changed-section hints, provenance metadata, topology trend history, and a JSON topology summary when JS/TS files are in scope.
- **Code topology:** `build-code-topology.js` builds a static JS/TS import graph with fan-in/fan-out hotspots, changed-file neighbors, source symbols with line ranges, changed sections, Markdown headings, and Git provenance.
- **Project code map:** `show-code-map.js` renders a compact maintainer-facing summary of topology, hotspots, sections, changed sections, provenance, trend deltas, and artifact paths. Code-map history retains the latest 50 snapshots by default.
- **Memory index:** `index-memory.js` indexes local Forgeflow memory so agents can use compact project history instead of reading full notes.
- **Memory context:** `build-memory-context.js` builds a compact memory summary for research, planning, consultation, and implementation.
- **Scope manifests:** `build-scope-manifest.js` creates file ownership packets for implementation waves.
- **Context telemetry:** context, memory, scope, and topology helpers emit token estimates and savings telemetry.
- **Budget checks:** `check-context-budget.js` reads `.forgeflow-budget.json` and warns when compact context exceeds configured limits.
- **Health repair:** `health-check.js --fix --json` creates safe project-local scaffolding and seeds budget config when missing.
- **Agent drift:** `check-agent-drift.js --json` compares consuming agent prompts against canonical shared intelligence sections and reports MISSING/DRIFTED sections. It handles mode-specific Arbiter expectations and treats explicitly adapted sections as informational.
- **Context advisor:** `advise-context.js --root .forgeflow --record --json` reports budget issues, low-savings packets, topology coverage signals, trimming recommendations, and previous-run trend deltas.
- **Project trends:** `show-project-trends.js` summarizes the latest code-map trend, artifact freshness, project-learning consumption, and advisor status from existing local artifacts. `/forgeflow-report` uses the same helper when available.
- **Forgeflow report:** `render-forgeflow-report.js` combines local telemetry, false-positive thresholds, pattern-log freshness, context savings, and project trends into one Markdown or JSON report.
- **Pattern learnings:** `rollup-pattern-learnings.js` scans cross-project `.forgeflow/<project>/learnings.jsonl` plus `project-learning-candidates.jsonl`, clusters known/candidate patterns with source-mix labels, and records `.learnings-log.jsonl` for `/forgeflow-report`.

Review context packs keep local memory hits bounded by default. If memory context dominates packet size, lower `build-context-pack.js --max-memory-chars` or split the review scope.

Useful commands:

```bash
scripts/forgeflow/build-context-pack.js --json
scripts/forgeflow/check-agent-drift.js --json
scripts/forgeflow/build-code-topology.js --json
scripts/forgeflow/show-code-map.js --json
scripts/forgeflow/show-project-trends.js --json
scripts/forgeflow/render-forgeflow-report.js --no-drift --json
scripts/forgeflow/rollup-pattern-learnings.js --dry-run --json
scripts/forgeflow/build-memory-context.js --json
scripts/forgeflow/build-scope-manifest.js --json
scripts/forgeflow/summarize-context-telemetry.js --root .forgeflow --json
scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json
scripts/forgeflow/advise-context.js --root .forgeflow --record --json
```

When Forgeflow is installed through `/update-forgeflow` without a local repo checkout, use the installed helper root instead:

```bash
~/.claude/forgeflow/scripts/forgeflow/advise-context.js --root .forgeflow --record --json
```

The context advisor appends compact history to:

```text
.forgeflow/context-advisor-history.jsonl
```

It also scans `.forgeflow/<project>/context/code-map-history.jsonl` when present and reports code-map trend attention items such as new hotspots, unresolved import growth, and changed-section churn.

## Implementation Notes And Pilot Evidence

During implementation, Forgeflow keeps a local notes file at:

```text
.forgeflow/<project-name>/implementation-notes.md
```

The notes checker catches empty notes, missing sections, sensitive-content patterns, and ship-summary rendering drift:

```bash
scripts/forgeflow/check-implementation-notes.js --json
```

For maintainer trials, Forgeflow can record local pilot evidence and refresh a rollup automatically:

```bash
scripts/forgeflow/record-pilot-evidence.js --runtime codex --health-result pass --json
scripts/forgeflow/rollup-pilot-evidence.js --json
```

The rollup stays local under `.forgeflow/<project-name>/` and summarizes pilot count, support categories, findings, review minutes, and the next recommended action.

Project learning rollups are planned around:

```text
.forgeflow/<project-name>/project-learnings.md
```

They capture durable project patterns across work items so future planning, implementation, review, and ship phases can account for recurring pitfalls and stable decisions. See [Project Learnings](docs/wiki/Project-Learnings.md).

Refresh the local rollup after several work items:

```bash
scripts/forgeflow/show-project-learnings.js
```

For the current checkout, `show-project-learnings.js` refreshes the compact code map before rolling up insights. The rollup adds structural hotspots, changed-section files, and code-map trend deltas to Hot Files And Modules, Risk Areas, and next-work guidance.

`/ship` refreshes the file during handoff prep, and `/forgeflow-health` surfaces the latest local summary when it exists.
During `/implement`, Atlas refreshes project learnings after implementation-note consolidation when the helper is available.
Structured candidates are stored locally in `.forgeflow/<project-name>/project-learning-candidates.jsonl` when Atlas records explicit learning categories. Candidates may include `confidence` (`low`, `medium`, or `high`), `evidence_count`, and compact `application_guidance` so agents can distinguish repeated, well-supported guidance from early signal and know how to apply it. Rollups include `Generated at` freshness metadata.

From Claude Code, use the command view:

```text
/forgeflow-learnings --project
/forgeflow-learnings --project --check
/forgeflow-trends
```

Review context packets include the latest insights and compact project code-map guidance so agents can account for recurring project patterns and structural hotspots while still verifying every finding against current artifacts.
Context packs only inject those insights when the project-learnings checker passes; non-passing checks produce a compact quality-gate warning instead of guidance.
Each context pack also writes `latest-insights-report.json` so users can see whether insights were injected, blocked, missing, or errored and which check issues caused the decision.
The checker guards that loop against sensitive content, placeholder-only output, oversized packets, duplicate bullets, malformed candidates, stale rollups, and missing proof-boundary text:

```bash
scripts/forgeflow/check-project-learnings.js --json
```

## Dashboard

The metrics dashboard is an optional local read-only HTTP server:

```text
/dashboard
```

It runs on `http://127.0.0.1:4003` and reads local telemetry files from `~/.claude/projects/`. For live agent-message observability, use `/agent-chat:on`, which runs a separate local dashboard on port `4001`. Forgeflow works without either dashboard.

## Documentation

- [Hosted docs entry](docs/index.html)
- [Wiki source](docs/wiki/Home.md)
- [Why Forgeflow](docs/wiki/Why-Forgeflow.md)
- [Project learnings](docs/wiki/Project-Learnings.md)
- [Maintainer pilot](docs/wiki/Maintainer-Pilot.md)
- [Team privacy boundaries](docs/wiki/Team-Privacy-Boundaries.md)
- [Support triage](docs/wiki/Support-Triage.md)
- [Team adoption criteria](docs/wiki/Team-Adoption-Criteria.md)
- [CI and headless deferrals](docs/wiki/CI-Headless-Deferrals.md)
- [Pilot evidence log](docs/wiki/Pilot-Evidence-Log.md)
- [Pilot public summary](docs/wiki/Pilot-Public-Summary.md)
- [Pilot support rollup](docs/wiki/Pilot-Support-Rollup.md)
- [Pilot adoption comparison](docs/wiki/Pilot-Adoption-Comparison.md)
- [Pilot next action decision](docs/wiki/Pilot-Next-Action-Decision.md)
- [Package and release onboarding](docs/wiki/Package-Release-Onboarding.md)
- [Branch trial](docs/wiki/Branch-Trial.md)
- [Public-safe examples](docs/wiki/Public-Examples.md)
- [Evaluation sharing](docs/wiki/Evaluation-Sharing.md)
- [Evaluation summary collection](docs/wiki/Evaluation-Summary-Collection.md)
- [Workflow comparison](docs/wiki/Workflow-Comparison.md)
- [First-run friction](docs/wiki/First-Run-Friction.md)
- [Friction to fix](docs/wiki/Friction-To-Fix.md)
- [Field validation](docs/wiki/Field-Validation.md)
- [Clean checkout install verification](docs/wiki/Clean-Checkout-Install-Verification.md)
- [Demos](docs/wiki/Demos.md)
- [Codex first run](docs/wiki/Codex-First-Run.md)
- [Dashboard](docs/wiki/Dashboard.md)
- [Context intelligence](docs/wiki/Context-Intelligence.md)
- [Context budget examples](docs/wiki/Context-Budget-Examples.md)
- [Common stack examples](docs/wiki/Common-Stack-Examples.md)
- [Migration guide](docs/wiki/Migration-Guide.md)
- [Settings and recovery](docs/wiki/Settings-And-Recovery.md)
- [Release process](docs/wiki/Release-Process.md)
- [Release gate](docs/wiki/Release-Gate.md)
- [Template installer](docs/wiki/Template-Installer.md)
- [Codex migration notes](CODEX_MIGRATION.md)
- [Telemetry schema](docs/forgeflow-metrics-telemetry-schema.md)
- [Verdict JSON schema](docs/forgeflow-json-schema.md)
- [Evaluation protocol](docs/forgeflow-evaluation-protocol.md)

## Current Status

Forgeflow is a local-first developer workflow for turning product intent into shipped code with explicit planning, implementation, review, verification, and release handoff. It currently targets Claude Code and Codex users who are comfortable installing command/agent files and running local scripts. The current pilot-evidence work focuses on real maintainer trials, public-safe summaries, support-triage rollups, and rollout decisions based on observed results.

## License

MIT. See [LICENSE](LICENSE).
