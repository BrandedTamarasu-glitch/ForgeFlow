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

For a path-by-path command map, start with [User Paths](docs/wiki/User-Paths.md). It covers install/update, refresh, failure investigation, review prep, ship, and release prep without repeating every command detail.

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

- **Context packs:** `build-context-pack.js` prepares bounded reviewer packets and a synthesis input file from the changed files, including latest insights, latest failure-digest context when present, compact project code-map guidance, changed-neighborhood topology context, topology-guided review focus, changed-section hints, provenance metadata, topology trend history, and a JSON topology summary when JS/TS files are in scope. Use `--root <repo>` when compiling packets for a target checkout from another current directory.
- **Code topology:** `build-code-topology.js` builds a static JS/TS import graph with fan-in/fan-out hotspots, changed-file neighbors, topology-guided review focus, source symbols with line ranges, changed sections, Markdown headings, Git provenance, and import-gap details for unresolved or dynamic imports. It resolves relative imports, source-suffix modules, extensionless TSX re-exports, tsconfig/jsconfig path aliases, common `@/` and `~/` src aliases, and literal dynamic imports when the target source file exists.
- **Project code map:** `show-code-map.js` renders a compact maintainer-facing summary of topology, hotspots, sections, changed sections, import gaps, provenance, trend deltas, a living project-map categorization, and artifact paths. Import gaps are classified as production or test/fixture scope so trends and smoke checks escalate the right work. Code-map history retains the latest 50 snapshots by default.
- **Living project map:** code-map and trends output classify structural movement as baseline, missing-history, new-hotspot, cooling-hotspot, import-gap growth/reduction, changed-section churn, graph-growth score, or stable structure. These are static JS/TS import and section signals only, not runtime behavior.
- **Living map review guidance:** context packs inject compact living project-map categories into reviewer packets and synthesis input as prioritization guidance only. The packet caveat explicitly says these static JS/TS import and section trends are not findings, proof of runtime behavior, or a dependency severity model.
- **Project intelligence rollup:** `build-project-intelligence.js` synthesizes project trends, project learnings, import gaps, failure-digest freshness, context advisor state, hot files, validation patterns, advisory-only agent feedback, Git provenance, and next actions into `.forgeflow/<project-name>/context/project-intelligence-rollup.{json,md}`. It refreshes project learnings and compact code-map context before synthesis unless a trends refresh already did that work. The rollup includes an explicit readiness state (`ready`, `needs-refresh`, `needs-triage`, or `blocked`), a next-work brief with read-first, avoid-first, validate-first, and proof-boundary guidance, a review-prep block with trust summary, refresh-first, review-note, read-first, and validate-first guidance, plus a separate agent-feedback section with advisory metadata, correction themes, promotion candidates, and stale markers.
- **Resolved edge summary:** project code maps show relative, alias, literal dynamic, source-suffix, and JS/JSX compatibility edge counts, plus compact alias and dynamic edge examples so users can understand why topology edge counts changed.
- **Import-gap triage:** code-map, trends, smoke, report, and context packs group import gaps into likely expected gaps versus gaps needing review, with categories for asset/data imports, non-literal dynamic imports, suffix-resolution gaps, aliases, local missing modules, and test fixtures.
- **Safe command-output reduction:** `compact-command-output.js`, `build-failure-digest.js`, and `advise-noisy-command.js` compact only allowlisted human-narrative output, preserve raw output for correctness-critical commands, stamp failure digests with Git provenance, and advise narrower invocations before large logs enter context.
- **Memory index:** `index-memory.js` indexes local Forgeflow memory so agents can use compact project history instead of reading full notes.
- **Memory context:** `build-memory-context.js` builds a compact memory summary for research, planning, consultation, and implementation.
- **Scope manifests:** `build-scope-manifest.js` creates file ownership packets for implementation waves.
- **Context telemetry:** context, memory, scope, and topology helpers emit token estimates and savings telemetry.
- **Budget checks:** `check-context-budget.js` reads `.forgeflow-budget.json` and warns when compact context exceeds configured limits.
- **Local artifact safety:** context and memory helpers reject symlinked memory sources and symlinked output destinations, include untracked files in scope summaries, and can fail CI predictably when generated packets exceed configured context budgets.
- **Health repair:** `health-check.js --fix --json` creates safe project-local scaffolding and seeds budget config when missing.
- **Guided repair:** `render-guided-repair.js` composes offline version status, health inventory, and installed runtime helper verification into a non-mutating repair plan with manual settings guidance and an explicit downstream smoke follow-up.
- **Installed runtime verification:** `/forgeflow-version` compares the recorded installed commit with upstream when online and verifies the installed runtime helper inventory against the managed manifest. If helpers are missing or invalid while the version is current, it reports the helper sources and the exact repair action, including a local-checkout fallback when the updater command itself is unavailable.
- **Release readiness:** `render-release-readiness.js` runs the local release-check command list, groups blockers by readiness area, and never tags, pushes, publishes, or calls GitHub.
- **Health recommendations:** `/forgeflow-health` reports latest-insights and latest failure-digest freshness, recommending `/forgeflow-trends --refresh` or `/forgeflow-failure-digest` when local guidance artifacts are stale.
- **Agent drift:** `check-agent-drift.js --json` compares consuming agent prompts against canonical shared intelligence sections and reports MISSING/DRIFTED sections. It handles mode-specific Arbiter expectations and treats explicitly adapted sections as informational.
- **Context advisor:** `advise-context.js --root .forgeflow --record --json` reports budget issues, low-savings packets, topology coverage signals, trimming recommendations, and previous-run trend deltas. It prefers canonical `context/latest` telemetry when the same artifact also exists in the project context root.
- **Project trends:** `show-project-trends.js` summarizes the latest code-map trend, living project-map categories, import-gap status, artifact freshness, latest-insights readiness/freshness, latest failure-digest provenance/freshness, project-learning consumption, and advisor status from existing local artifacts. `/forgeflow-report` uses the same helper when available.
- **Latest-insights state:** `latest-insights-state.js` provides the shared readiness/freshness check used by health, report, and trends so stale guidance is reported consistently.
- **Privacy boundary:** `privacy-boundary.js` centralizes sensitive-content detection, public-safe blocker normalization, and shell argument quoting for local learning, pilot, feedback, adoption, and implementation-note helpers.
- **Agent feedback rollup:** `rollup-agent-feedback.js` summarizes local `agent-feedback.jsonl` by reviewer, signal, promotable count, corrective count, skipped invalid/private lines, filtered advisory examples, correction themes, manual-promotion candidates, and stale markers.
- **Forgeflow report:** `render-forgeflow-report.js` combines local telemetry, false-positive thresholds, pattern-log freshness, context savings, project trends, import-gap status, latest-insights readiness/freshness, latest failure-digest status/freshness, and direct next-action recommendations into one Markdown or JSON report. Use `--refresh` to update project guidance first.
- **Release notes draft:** `render-release-notes.js` collects plugin version, matching changelog, recent commits, dirty state, and release-gate commands into a public-safe Markdown or JSON release-note draft.
- **Release readiness blockers:** `render-release-readiness.js` classifies release preflight blockers as command failures, allowlist issues, missing commands, missing release-check source, or execution-environment blockers such as restricted nested process spawning. Execution-environment blockers should be cleared by running the listed release-check command directly in the same trusted local environment used for release validation, or by rerunning readiness where local process spawning is permitted.
- **Smoke check:** `smoke-check.js` defaults to downstream readiness checks for health, trends refresh, report refresh, and code map. Warn/fail checks include reason, evidence, clearing guidance, and next actions in JSON and Markdown. Use `--mode source` for source-tree release guards plus packaged and installed-runtime dogfood self-tests, or `--mode full` for both groups.
- **Pilot script:** `render-pilot-script.js` prints a maintainer trial script by default and a first-real-task new-user path with `--path new-user`. Both paths cover install/readiness checks, project guidance, one bounded work item, review, evidence capture, rollup, and a public-safe result template. The new-user path is state-aware: it includes guided repair, release-readiness preview, project intelligence, living project-map status, and agent-feedback signal checks before the first task decision.
- **Adoption pack:** `render-adoption-pack.js` gives net-new users a concise fit guide, first-trial path, existing pilot-evidence rollup, recommended action, owner lane, blocker, public-safe summary, small-team handoff checklist, proof boundary, and repeat/expand/fix/defer decision rubric. Pilot rollups now explain the decision using setup friction, project-intelligence readiness, living project-map status, and agent-feedback signal.
- **Pattern learnings:** `rollup-pattern-learnings.js` scans cross-project `.forgeflow/<project>/learnings.jsonl` plus `project-learning-candidates.jsonl`, clusters known/candidate patterns with source-mix labels, and records `.learnings-log.jsonl` for `/forgeflow-report`.

Review context packs keep local memory hits bounded by default. If memory context dominates packet size, lower `build-context-pack.js --max-memory-chars` or split the review scope.

Review and ship commands now keep the approval handoff explicit: `/review` records final verdicts in `.forgeflow/<project>/review-history.md`, `/review-auto` records post-fix approval state, and `/ship` treats secret-scan matches as hard stops before PR creation.

Useful commands:

```bash
scripts/forgeflow/build-context-pack.js --root . --json
scripts/forgeflow/check-agent-drift.js --json
scripts/forgeflow/build-code-topology.js --json
scripts/forgeflow/show-code-map.js --json
scripts/forgeflow/show-project-learnings.js --check --json
scripts/forgeflow/show-project-trends.js --json
scripts/forgeflow/render-forgeflow-report.js --no-drift --json
scripts/forgeflow/smoke-check.js --json
scripts/forgeflow/render-adoption-pack.js --runtime codex
scripts/forgeflow/render-pilot-script.js --runtime codex
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
scripts/forgeflow/render-pilot-script.js --runtime codex
scripts/forgeflow/record-pilot-evidence.js --runtime codex --health-result pass --json
scripts/forgeflow/rollup-pilot-evidence.js --json
```

The pilot script prints the bounded trial path and public-safe result template. The rollup stays local under `.forgeflow/<project-name>/` and summarizes pilot count, support categories, findings, review minutes, and the next recommended action.

For a net-new user deciding whether Forgeflow is worth adopting, render the adoption pack and first-real-task path. The generated path starts with guided repair and release-readiness preview, then uses project intelligence, the living project map, project learnings, and agent-feedback signals to decide whether the first task and the next task are getting better:

```bash
scripts/forgeflow/render-adoption-pack.js --runtime codex
scripts/forgeflow/render-pilot-script.js --path new-user --runtime codex
```

From Claude Code:

```text
/forgeflow-adoption --runtime claude-code
/forgeflow-pilot --path new-user --runtime claude-code
```

The adoption pack is the “why should I use this?” view. It includes a public-safe aggregate summary and small-team handoff checklist so the next decision can be repeat, expand, stop-and-fix, or defer without sharing raw `.forgeflow/` records.

To capture whether agent guidance helped or needed correction, record local feedback:

```bash
scripts/forgeflow/record-agent-feedback.js \
  --agent smith_reviewer \
  --signal incorrect \
  --summary "Flagged a safe query as unsafe" \
  --correction "The query used parameter binding" \
  --confidence high \
  --evidence-count 2 \
  --promote \
  --json
```

Feedback stays local in `.forgeflow/<project-name>/agent-feedback.jsonl`. Promotion is explicit and requires medium or high confidence with at least two pieces of evidence.
Project intelligence reads the local feedback log as advisory signal only. `scripts/forgeflow/rollup-agent-feedback.js --json` gives the same feedback its own quality rollup by reviewer, signal, promotable count, corrective count, skipped invalid/private lines, filtered advisory examples, correction themes, manual-promotion candidates, and stale markers. Promoted project-learning candidates still require the same confidence/evidence gate and current-code verification.

Project learning rollups are planned around:

```text
.forgeflow/<project-name>/project-learnings.md
```

They capture durable project patterns across work items so future planning, implementation, review, and ship phases can account for recurring pitfalls and stable decisions. See [Project Learnings](docs/wiki/Project-Learnings.md).

Refresh the local rollup after several work items:

```bash
scripts/forgeflow/show-project-learnings.js
```

Build the compact project intelligence rollup before planning or review:

```bash
scripts/forgeflow/build-project-intelligence.js --json
```

The rollup includes Git provenance, explicit readiness (`ready`, `needs-refresh`, `needs-triage`, or `blocked`), a next-work brief, and a review-prep section that separates runnable refresh commands, advisory notes, first reads, and validation targets. The next-work brief gives the next implementer compact read-first, avoid-first, validate-first, and proof-boundary guidance. It refreshes project learnings and compact code-map context before synthesis unless `--refresh` already refreshed trends and project guidance. Treat it as a compact orientation layer over the raw trends, topology, failure-digest, feedback, and project-learning artifacts.

For the current checkout, `show-project-learnings.js` refreshes the compact code map before rolling up insights. The rollup adds structural hotspots, changed-section files, and code-map trend deltas to Hot Files And Modules, Risk Areas, and next-work guidance.

`/ship` refreshes the file during handoff prep, and `/forgeflow-health` surfaces the latest local summary plus latest-insights readiness/freshness when they exist.
During `/implement`, Atlas refreshes project learnings after implementation-note consolidation when the helper is available.
Structured candidates are stored locally in `.forgeflow/<project-name>/project-learning-candidates.jsonl` when Atlas records explicit learning categories. Candidates may include `confidence` (`low`, `medium`, or `high`), `evidence_count`, compact `application_guidance`, `status` (`active`, `stale`, or `superseded`), and `superseded_by` replacement guidance. Rollups keep inactive candidates in local history but omit them from agent-facing guidance. Rollups include `Generated at` freshness metadata.

From Claude Code, use the command view:

```text
/forgeflow-learnings --project
/forgeflow-learnings --project --check
/forgeflow-trends
```

`/forgeflow-trends` shows code-map trend, living project-map categories, import-gap status, project-learning freshness, latest-insights readiness/freshness, latest failure-digest provenance/freshness, and context-advisor status in one compact project guidance health view. Use `/forgeflow-trends --refresh` to refresh project learnings and latest-insights readiness before rendering the view. When stale guidance is detected, the report recommends that refresh command directly.

`/forgeflow-learnings --project --check` refreshes the learning rollup, runs the quality gate, performs a context-pack smoke, and reports whether latest insights will be injected into future agent packets.

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
- [User paths](docs/wiki/User-Paths.md)
- [Forgeflow 4.3 release brief](docs/wiki/Forgeflow-4.3-Release-Brief.md)
- [Why Forgeflow](docs/wiki/Why-Forgeflow.md)
- [Project learnings](docs/wiki/Project-Learnings.md)
- [Maintainer pilot](docs/wiki/Maintainer-Pilot.md)
- [Adoption pack](docs/wiki/Adoption-Pack.md)
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

Release checks guard stale-guidance next actions so `/forgeflow-health`, `/forgeflow-trends`, `/forgeflow-report`, and this README continue to point users at `/forgeflow-trends --refresh`.

## Current Status

Forgeflow is a local-first developer workflow for turning product intent into shipped code with explicit planning, implementation, review, verification, and release handoff. It currently targets Claude Code and Codex users who are comfortable installing command/agent files and running local scripts. The current work is shifting from broad feature expansion to stabilization: real maintainer trials, smoke automation, report/readme/wiki polish, and targeted fixes from observed use.

## License

MIT. See [LICENSE](LICENSE).
