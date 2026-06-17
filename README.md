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
- **Learn how the user operates:** user profiles capture local advisory preferences for communication, autonomy, validation, releases, and project look/feel so agents can adapt without overriding current instructions or safety gates. Suggestions and conflict warnings help the user refine the profile without automatic inference.
- **Guide first-time users:** `/forgeflow-first-run` gives net-new users one compact path for install verification, project orientation, profile readiness, and a bounded first work item.
- **Learn locally:** calibration and outcome records stay on your machine unless you choose to share them. Workflow-ending capture and telemetry-quality checks make it clear when those local signals are ready versus too thin to trust.
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
- `/handoff` to write a rolling resume document for a future session.

Additional direct-work surfaces:

- `/create-agent` creates local custom Claude agents under `~/.claude/agents/custom-*.md`.
- `/debate` stress-tests Forgeflow review behavior against a code sample and sealed answer key.
- `/fleet` runs independent phased work in isolated worktrees, then merges shards sequentially with validation.
- `/ui-iterate` runs measured UI/theme iteration with Playwright screenshots, accessibility scoring, ranked variants, and a local report.
- `/agent-chat:on` and `/agent-chat:off` start and stop the live local agent-message dashboard.

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

## Capability Map

Forgeflow currently covers:

- **Lifecycle delivery:** discussion, research, planning, consultation, implementation, review, automated safe-fix attempts, audit, ship, and handoff.
- **Install and runtime confidence:** `/update-forgeflow`, `/forgeflow-version`, `/forgeflow-health`, `/forgeflow-repair`, `/forgeflow-update-verify`, `/forgeflow-runtime-drift`, runtime inventory, repair previews, rollback, and source/downstream smoke checks.
- **Context and token efficiency:** context packs, memory summaries, scope manifests, context budgets, context advisor, context retention, context waves, command-output compaction, failure digests, validation-failure capture, noisy-command advice, and telemetry summaries.
- **Project intelligence:** code maps, trends, health timelines, project operating model, project decision brief, architecture docs, invocation hints, ownership map, dogfood report, dogfood refresh plan, latest-insights injection, and project readiness in the dashboard.
- **Learning loops:** implementation notes, project learnings, pattern rollups, user operating profile, project experience profile, learning status, learning action routing, outcome capture, agent feedback, first-run evidence, pilot evidence, and next-work ranking.
- **Review automation safety:** review evidence schema checks, review-auto classification, deterministic sandbox proposals, explicit apply flow with rollback on failed validation, review-auto status, output contracts, command-argument safety, and wrapper drift planning.
- **Adoption and reporting:** first-run guide, first-run simulator, first-useful-win summary, first-task report, adoption pack, pilot scripts, evaluation reports, support bundles, public-safe summaries, and team adoption/privacy guidance.
- **Dashboards and team surfaces:** local metrics dashboard, Project Readiness panel, agent-chat dashboard, `/forgeflow-sync` team-state guidance, `/sync-upstream` for Forgeflow meta-work, and `/ci-wrapper` reference docs for headless PR review wiring.

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

These records are local-first. They are meant to help you understand false positives, verifier outcomes, accepted findings, review time, and auto-fix quality. Review outcomes also expose aggregate learning signals for true positives, false positives, missed issues, stale guidance, and manual promotion candidates so later planning can distinguish useful reviewer guidance from guidance that should be corrected.

## Local Context Intelligence

Forgeflow includes local-only helpers that reduce agent prompt load before review or implementation work starts:

- **Context packs:** `build-context-pack.js` prepares bounded reviewer packets and a synthesis input file from the changed files, including latest insights, user profile guidance, compact project operating-model guidance, compact architecture/ownership/invocation intelligence when present, quality-gated lean guidance when present, latest failure-digest context when present, compact project code-map guidance, changed-neighborhood topology context, topology-guided review focus, changed-section hints, provenance metadata, topology trend history, a per-agent context contract, and a JSON topology summary when JS/TS files are in scope. Use `--root <repo>` when compiling packets for a target checkout from another current directory.
- **Insight injection view:** `/forgeflow-insight-injection` shows the latest packet artifact decisions, compares them with a prior baseline when available, exposes per-agent signal contracts, quality-gate controls, and next clearing command so users can see which insight blocks are included, metadata-only, or skipped before agent-heavy work.
- **First-run guide and first task evidence:** `/forgeflow-first-run` prints a non-mutating path for install verification, project orientation, project-map evolution, profile readiness, insight-injection inspection, one bounded work item, and stop conditions. `/forgeflow-first-run-simulator` checks release version evidence, the runtime-specific first-use path, and source-smoke readiness before a fresh-user trial. `/forgeflow-first-run-result` records public-safe local outcomes under `.forgeflow/<project>/first-run-results/`, `/forgeflow-first-run-rollup` summarizes aggregate onboarding friction without sharing raw result files, `/forgeflow-first-useful-win` turns early first-run, pilot, feedback, and learning-status evidence into a compact "what helped" report, `/forgeflow-first-task-report` summarizes the first real work item's success signals, blockers, and next adoption action, and `/forgeflow-first-task-adoption-loop` turns those signals into a repeat, fix, defer, or expand decision.
- **User profile guidance:** `/forgeflow-profile` records, checks, and shows local user operating preferences plus project experience preferences. `/forgeflow-profile-bootstrap` previews explicit operating and project experience preference records, can show prompt templates with `--prompts`, returns the next profile action, reports setup readiness across required operating and recommended project-style prompts, includes prompt groups for required operating, optional workflow, and optional project-style answers, includes a guided path from required answers to preview, confirmed write, and profile check, and writes only when `--write` is supplied. `/forgeflow-profile-review` groups conflicts, scope moves, ask-user prompts, cleanup actions, confirmation prompts, explicit accept/reject/supersede/defer options, injection eligibility, safe next steps, and a resolution flow before agent-heavy work. Context packs inject a compact advisory profile only after the profile quality gate passes. Global operating preferences live under `~/.claude/forgeflow/`; project look/feel preferences live under `.forgeflow/<project>/`. The profile checker also surfaces advisory suggestions, potential conflicts, and role-specific guidance for how agents should use preferences.
- **Code topology:** `build-code-topology.js` builds a static JS/TS import graph with fan-in/fan-out hotspots, changed-file neighbors, topology-guided review focus, source symbols with line ranges, changed sections, Markdown headings, Git provenance, unsupported-language scope, and import-gap details for unresolved or dynamic imports. It resolves relative imports, source-suffix modules, extensionless TSX re-exports, tsconfig/jsconfig path aliases, package.json `imports` aliases such as `#/*`, common `@/` and `~/` src aliases, and literal dynamic imports when the target source file exists.
- **Architecture docs:** `/forgeflow-architecture` renders advisory architecture docs from local topology, project intelligence, the project operating model, and project-learning artifacts. Default output is read-only; `--write` stores `.forgeflow/<project>/context/architecture.md` and `.json` without editing repo docs or claiming runtime proof.
- **Invocation hints:** `/forgeflow-invocation-hints` renders advisory runtime entrypoint and invocation hints from package scripts, package entry fields, bins, common config files, route-like paths, topology, and architecture evidence. Default output is read-only; `--write` stores `.forgeflow/<project>/context/invocation-hints.md` and `.json` without executing scripts, starting servers, or claiming a full runtime call graph.
- **Ownership map:** `/forgeflow-ownership` renders advisory owner-surface recommendations from local topology, architecture, project operating-model, and optional CODEOWNERS evidence. Default output is read-only; `--write` stores `.forgeflow/<project>/context/ownership-map.md` and `.json` without editing CODEOWNERS, assigning reviewers, or claiming permission proof.
- **Dogfood report:** `/forgeflow-dogfood-report` reviews the Phase 8-11 local evidence trail and recommends keep, refine, or consider narrow opt-in promotion for higher automation. It is read-only by default, writes only `.forgeflow/<project>/context/dogfood-report.*` with `--write`, and never patches files, calls GitHub, pushes, publishes, batches fixes, or promotes automation automatically.
- **Dogfood refresh plan:** `/forgeflow-dogfood-refresh-plan` turns missing dogfood evidence into ordered local refresh commands without running them. Use it before rerunning the dogfood report when architecture, ownership, invocation, or context-pack evidence is incomplete.
- **Project code map:** `show-code-map.js` renders a compact maintainer-facing summary of topology, hotspots, sections, changed sections, import gaps, provenance, trend deltas, a living project-map categorization, and artifact paths. Import gaps are classified as production or test/fixture scope so trends and smoke checks escalate the right work. Code-map history retains the latest 50 snapshots by default.
- **Living project map:** code-map and trends output classify structural movement as baseline, missing-history, new-hotspot, cooling-hotspot, import-gap growth/reduction, changed-section churn, graph-growth score, or stable structure. These are static JS/TS import and section signals only, not runtime behavior.
- **Living map review guidance:** context packs inject compact living project-map categories into reviewer packets and synthesis input as prioritization guidance only. The packet caveat explicitly says these static JS/TS import and section trends are not findings, proof of runtime behavior, or a dependency severity model.
- **Project intelligence and operating model:** `build-project-intelligence.js` synthesizes project trends, project learnings, import gaps, failure-digest freshness, context advisor state, hot files, validation patterns, advisory-only agent feedback, aggregate review-outcome learning signals, next-work outcome confidence, Git provenance, and next actions into `.forgeflow/<project-name>/context/project-intelligence-rollup.{json,md}`. It refreshes project learnings and compact code-map context before synthesis unless a trends refresh already did that work. The rollup includes an explicit readiness state (`ready`, `needs-refresh`, `needs-triage`, or `blocked`), a next-work brief with read-first, avoid-first, validate-first, and proof-boundary guidance, advisory next-work item candidates with evidence strength, confidence score and reason codes, what-to-change, how-to-prove, stop-when, start, and validation fields, a review-prep block with trust summary, refresh-first, review-note, read-first, and validate-first guidance, plus separate agent-feedback, review-outcome, and next-work confidence sections with advisory metadata. `build-project-operating-model.js` and `/forgeflow-project-model` turn that evidence into a compact advisory model of domains, high-care files, risk zones, validation norms, operating preferences, agent guidance, review policy hints, and proof boundaries, then append compact history snapshots for drift comparison. `/forgeflow-trends` reports advisory operating-model drift across domains, high-care files, risk zones, and validation patterns, while `/forgeflow-learning-status` treats the operating model as one local guidance signal. Context packs inject the compact model into agent packets as verify-before-use guidance. First-run missing failure digests stay informational until a failed command has actually been captured; first-run fallback guidance starts with install health and project orientation; outcome capture surfaces include after-action prompts; and next-work ranking uses an explicit policy that favors current actionable risks over readiness or history-only noise. `/forgeflow-project-brief` reads existing local intelligence artifacts and produces a compact decision brief with recent changes, avoid-first, validate-first, and high-care file guidance for the next work item without refreshing or writing project state.
- **Lean decision, mode, status, debt, audit, review, lab, benchmark, and metrics:** `/forgeflow-lean-decision --task "<work item>"` gives a read-only minimum-sufficient-solution check before implementation. It points to native, standard-library, installed-dependency, or project-pattern reuse candidates, lists avoid-first work, names do-not-simplify boundaries such as security, accessibility, trust-boundary validation, data-loss prevention, explicit requirements, and calibration or physical-device tuning controls, then gives the focused validation minimum plus the known ceiling and upgrade trigger for expanding later. `/forgeflow-lean-mode --profile off|lite|balanced|strict|ultra --write` persists a project-local advisory lean profile in `.forgeflow/<project>/context/lean-policy.{md,json}`; add `--user --write` to persist a user-level default under the platform Forgeflow config directory. `off` blocks lean context injection, `lite` only asks the agent to name the smaller alternative while building what was asked, and `balanced`, `strict`, and `ultra` tune the compact guidance budget without changing implementation, review, commit, push, or network behavior. Profile precedence is explicit request, project policy, `FORGEFLOW_LEAN_DEFAULT_MODE`, user config, then balanced. `/forgeflow-lean-session` renders compact always-on lean guidance plus `LEAN:<profile>` statusline text; the managed `forgeflow-lean-activate.js` hook uses the same canonical rule text for SessionStart/UserPromptSubmit when users wire it in settings. `/forgeflow-lean-portability --write` writes portable lean rule copies for generic agents, Cursor, Windsurf, Cline, Copilot, Copilot CLI, Kiro, OpenCode, Gemini/Antigravity, OpenClaw-style skills, and skill-style adapters under `.forgeflow/<project>/lean-portability/`. `/forgeflow-lean-behavior --file <path>` evaluates generated output with read-only probes for calibration boundaries, requested explanation preservation, one runnable check, dependency justification, stdlib/native/reuse evidence, and explicit requirement preservation. `/forgeflow-lean-eval` runs deterministic local fixture checks over those behavior probes without calling models, running generated code, installing dependencies, or using the network. `/forgeflow-lean-status` shows whether lean guidance is configured, blocked, or eligible for context-pack injection, including lean-decision/report freshness, latest-insights, profile, operating-model, telemetry, helper availability, and automatic consult/implement/review/ship wiring. Optional inline markers such as `forgeflow: lean: <reason>`, `forgeflow: upgrade when: <trigger>`, `forgeflow: no-new-deps`, `forgeflow: stdlib-first: <reason>`, `forgeflow: native-first: <reason>`, and `forgeflow: reuse-first: <reason>` act as advisory breadcrumbs for why a small path was chosen, and `/forgeflow-lean-debt` turns those markers plus lean-decision and implementation-note ceiling records into a local ledger that flags missing upgrade triggers. `/forgeflow-lean-audit` scans the repo for ranked over-engineering candidates such as avoidable dependencies, one-caller abstractions, delegating wrappers, future-proofing, and marker debt while skipping hard-boundary scopes. `/consult`, `/implement`, Codex consult/implement skills, and generated project-intelligence brief stubs carry the same compact lean section into handoffs when the helper is available. `/implement` also writes a lean-decision JSON sidecar so Atlas can record the ceiling and upgrade trigger in implementation notes with `record-implementation-notes.js --lean-decision`. `/review` automatically writes `context/latest/lean-review.{md,json}` as a separate advisory lane when the helper is available; `/forgeflow-lean-review` exposes the same read-only over-engineering lane for `delete`, `stdlib`, `native`, `reuse`, `yagni`, `shrink`, and `prose-bloat` findings, enriched with static project evidence, confidence, replacement guidance, estimated net lines, why-safe/why-not-safe evidence, proof steps, package dependency deltas, lean markers, and suppressed false-positive candidates when those artifacts exist. `/ship` writes a local lean-readiness advisory when a lean decision exists without report or ceiling evidence. `/forgeflow-lean-lab --task-pack <json> --results <json>` compares baseline, balanced, strict, and ultra guidance across repeatable local task-pack results, requiring visible sample size and passing validation before ranking modes; `--write` stores `.forgeflow/<project>/context/lean-lab.{md,json}`. `/forgeflow-lean-benchmark --baseline <json> --current <json>` compares local aggregate baseline and lean-guided metrics for files, lines, validation signals, review findings, prose warnings, ceiling captures, follow-up signals, and context-token savings; `--write` stores `.forgeflow/<project>/context/lean-benchmark.{md,json}`. `/forgeflow-output-contract --lean-file <path>` can warn when a generated lean handoff or review note has too much narrative, while preserving raw command output, diffs, failure evidence, review evidence, and user-requested explanations. `/forgeflow-lean-report` summarizes local aggregate lean signals such as files and lines touched, reuse and avoid-first counts, validation and ceiling capture, review/prose warnings, context-token savings, and telemetry quality without raw snippets or hosted telemetry. Context packs inject the compact lean block only when lean mode permits it and lean-decision, lean-report, latest-insights, profile, operating-model, and telemetry gates pass. It is not a correctness, security, accessibility, performance, or validation review and never applies fixes or workflow policy changes.
- **Lean portability confidence:** `/forgeflow-lean-adapter-contract`, `/forgeflow-lean-hook-contract`, `/forgeflow-lean-rule-canary`, `/forgeflow-lean-robustness`, and `/forgeflow-lean-host-packages` add local confidence checks for adapter targets, hook subprocess behavior, load-bearing rule invariants, known lazy-wrong correctness traps, and host package guidance. They do not install adapters, edit host settings, commit, push, or call the network; `--write` on host packages stores only `.forgeflow/<project>/lean-packages/`.
- **Lean host adapter proof:** `/forgeflow-lean-host-adapters`, `/forgeflow-lean-adapter-smoke`, `/forgeflow-lean-adapter-drift`, and `/forgeflow-lean-correctness` validate committed host adapter files, plugin wrapper shape, generated-copy drift, and executable correctness canaries. They are local checks and do not launch host apps, install adapters, call models, commit, push, or call the network.
- **Lean host runtime parity:** `/forgeflow-lean-host-command-parity`, `/forgeflow-lean-pi-smoke`, and `/forgeflow-lean-benchmark-runner` cover command-capable host drift, pi extension runtime behavior, and opt-in reproducible benchmark scaffolding. The benchmark runner emits commands and local files only; model-backed runs require explicit external setup.
- **Lean benchmark evidence:** `/forgeflow-lean-benchmark-results`, `/forgeflow-lean-openclaw-skill`, and `/forgeflow-lean-windows-smoke` add aggregate result claim checks, generated OpenClaw skill currentness, and Windows-style lean hook/statusline compatibility checks.
- **Next-work ranking:** `/forgeflow-next-work-ranking` reads current local project intelligence and related context-budget, failure-digest, outcome, profile, and hot-file signals, then ranks candidate next items with confidence, evidence strength, demotion conditions, validation hints, an advisory proof boundary, and copy-ready `record-next-work-outcome` prompts for after real action. It does not refresh artifacts or select work automatically.
- **Next-work outcome capture:** `/forgeflow-next-work-outcome` records whether a ranked next-work recommendation was useful, ignored, incorrect, or blocked so future recommendations can be calibrated from observed results.
- **Efficiency gap plan:** `/forgeflow-efficiency-gaps` combines next-work ranking, learning status, outcome capture readiness, failure-digest readiness, runtime inventory hotspots, sparse telemetry, and live context-advisor budget state into five ranked phases with safe slices, validation commands, and high-risk boundaries. It is read-only and does not record outcomes, infer preferences, execute failed commands, edit files, commit, push, or spawn agents.
- **Workflow readiness queue:** `/forgeflow-workflow-readiness` consolidates the next safe action across context-budget review waves, outcome calibration, explicit profile setup, telemetry quality, and runtime inventory parity. It includes an automation runbook with stop rules for observed evidence, explicit profile confirmation, and high-risk review-wrapper work. It keeps high-risk `/review` safe-args work paused separately and does not write wave files, record outcomes, infer preferences, change routing, repair installs, commit, push, or call GitHub.
- **Review wave prep and outcome capture:** `/forgeflow-context-wave-plan` now flags incomplete zero-file packets, prioritizes first waves using path risk, topology hubs, changed-neighborhood hints, and proof-file markers, reports per-wave budget status, proof contracts, and verification commands, and still writes files only with `--write-wave-files`. `/forgeflow-context-wave-build` rebuilds the first focused context packet from that explicit wave file list, reports post-build budget status, write boundary, verification command, focused-packet handoff, and does not spawn reviewers. `/forgeflow-review-wave-prep` turns the plan into the first focused review-wave command and reports whether the first wave is ready, still needs wave files, or must wait for a rebuilt context pack. `/forgeflow-outcome-capture-plan` shows which local outcome streams still need real recorder evidence, adds per-stream capture runbooks, and `/forgeflow-workflow-ending-capture` narrows that to the one event-specific recorder prompt to consider after review, next-work, or agent-feedback endings while also surfacing required evidence values, the matching learning-capture nudge, and observed-evidence stop rule.
- **Resolved edge summary:** project code maps show relative, alias, literal dynamic, source-suffix, and JS/JSX compatibility edge counts, plus compact alias and dynamic edge examples so users can understand why topology edge counts changed.
- **Import-gap triage:** code-map, trends, smoke, report, and context packs group import gaps into likely expected gaps versus gaps needing review, with categories for asset/data imports, non-literal dynamic imports, suffix-resolution gaps, aliases, local missing modules, and test fixtures.
- **Safe command-output reduction:** `/forgeflow-compact-output`, `/forgeflow-capture-output`, `/forgeflow-failure-digest`, and `/forgeflow-noisy-command` compact only allowlisted human-narrative output such as test, typecheck, lint, build, log, grep, status, tree, and JSON summaries. The compactor can infer safe presets from common command shapes with `--preset auto`, while diffs, patches, SHAs, exact file lists, and other correctness-critical commands stay raw-required. They preserve raw output for correctness-critical commands, stamp failure digests with Git provenance, advise narrower invocations before large logs enter context, and label first-run missing digest state as informational until the first failed command is captured.
- **Validation failure capture:** `/forgeflow-validation-failure-capture --command "<cmd>"` maps a failed validation command to the correct capture mode, failure-digest path, and first-run capture prompt without executing the command or writing the digest. `/forgeflow-validation-plan` includes a compact "If a command fails" section with the matching capture command for focused, full-suite, and source-smoke checks. Exact diffs, patches, hashes, and file-list outputs stay raw-required.
- **Memory index:** `index-memory.js` indexes local Forgeflow memory so agents can use compact project history instead of reading full notes.
- **Memory context:** `build-memory-context.js` builds a compact memory summary for research, planning, consultation, and implementation.
- **Scope manifests:** `build-scope-manifest.js` creates file ownership packets for implementation waves.
- **Context telemetry:** context, memory, scope, and topology helpers emit token estimates and savings telemetry.
- **Budget checks:** `check-context-budget.js` reads `.forgeflow-budget.json` and warns when compact context exceeds configured limits.
- **Local artifact safety:** context and memory helpers reject symlinked memory sources and symlinked output destinations, include untracked files in scope summaries, and can fail CI predictably when generated packets exceed configured context budgets. `/forgeflow-context-wave-plan` turns over-budget packet telemetry into staged review waves and can write explicit wave file lists with `--write-wave-files`; `/forgeflow-context-wave-build` uses those lists to create one focused local context pack under `.forgeflow/` without shelling out or spawning reviewers. `/forgeflow-context-retention` adds a read-only freshness and retention review for latest context artifacts, agent packets, broad context files, code-map history, and context-advisor history without deleting or compacting anything, and `/forgeflow-stale-artifact-plan` shows minimal refresh commands for stale local guidance.
- **Health repair:** `health-check.js --fix --json` creates safe project-local scaffolding and seeds budget config when missing.
- **Guided repair:** `/forgeflow-repair` and `render-guided-repair.js` compose offline version status, health inventory, and installed runtime helper verification into a non-mutating repair plan with manual settings guidance and an explicit downstream smoke follow-up.
- **Installed runtime verification:** `/forgeflow-version` compares the recorded installed commit with upstream when online and verifies the installed runtime helper inventory against the managed manifest. If helpers are missing or invalid while the version is current, it reports the helper sources and the exact repair action, including a local-checkout fallback when the updater command itself is unavailable. Add `--snapshot` to write a local support artifact at `~/.claude/forgeflow/version-snapshot.json`. `/forgeflow-update-verify` adds a read-only post-update loop for installed version state and runtime drift with a ready, restart, or repair next action, plus drift guidance that separates missing version metadata, source/install drift, and runtime drift that still needs repair.
- **Release readiness:** `/forgeflow-release-check` and `render-release-readiness.js` run the local release-check command list, verify runtime helper sources are present, managed, regular files, and inside the checkout before install, group blockers by readiness area, can compare against a prior JSON baseline with `--baseline` or the saved local snapshot with `--compare-last`, can update that snapshot with `--save-current`, and never tag, push, publish, or call GitHub. `/forgeflow-release-verify` prints the compact shareable post-publish summary, can save or compare the local post-publish snapshot, includes installed-version and runtime-drift consumability evidence, and adds optional `--github` read-only GitHub release/tag evidence when explicitly requested. `/forgeflow-release-follow-through` checks the post-publish verify, update verify, and runtime-consumability follow-through steps, then reports install-readiness plus a release-consumption verdict with confidence, blockers, informational follow-ups, and the next verification command; add `--save` to persist the latest local follow-through snapshot. `/forgeflow-release-consumption` rolls the follow-through verdict into a compact consumed-or-attention summary, leaves downstream smoke as an explicit `--with-smoke` action, and only writes a local release-consumption snapshot when `--save` is supplied. `/forgeflow-release-consumption-loop` shows the ordered post-release update, smoke, and consumption loop with a `release-consumption-complete` or attention badge plus a read-only dogfood report and downstream efficiency trial checklist without running update, repair, smoke, or snapshot writes. `/forgeflow-post-release-install-verify` combines release verification, install consumability, and downstream smoke into one read-only after-update verdict, treating mode-only install drift as informational instead of repair-required. GitHub verification distinguishes unavailable network/tool access from a genuinely missing release or tag; in sandboxed Codex or Claude sessions, `network-unavailable` means rerun with network access before concluding anything is missing.
- **Runtime drift preview:** `/forgeflow-runtime-drift --preview-repair` shows the exact managed helpers that `/update-forgeflow --repair` would install, replace, chmod, or leave alone. Missing helpers, content drift, and syntax failures stay actionable; mode-only drift is reported separately as informational. The preview is read-only and does not mutate installed files.
- **Runtime and command inventory:** `runtime-inventory.js` exposes one shared command/helper summary with helper groups, installed names, registry counts, canonical consolidation checks, and read-only coordination-pressure guidance for coverage, health, install, update, release, and docs checks. `render-command-index.js` generates a compact command index from command frontmatter plus runtime-inventory command discovery so docs can stay thin without duplicating long command lists.
- **Command wrapper contract:** `command-wrapper-contract.js` inventories helper-backed command wrappers for installed fallback, repair guidance, safe argument forwarding, and Node environment scrubbing. Existing wrapper drift is reported as a baseline with issue counts grouped by type and a ranked next-batch list so consolidation can happen in safe command-sized slices. `/forgeflow-command-wrapper-batch` ranks the next small cleanup batch without editing files, and `/forgeflow-wrapper-drift-plan` separates safe mechanical cleanup from manual or high-risk wrapper work such as broad `/review` argument parsing.
- **Project health timeline:** `/forgeflow-health-timeline` summarizes local code-map history, context-advisor history, latest-insights readiness, learning-signal quality, comparable deltas, and project-map evolution into a compact advisory timeline.
- **Health recommendations:** `/forgeflow-health` reports latest-insights and latest failure-digest freshness, recommending `/forgeflow-trends --refresh` or `/forgeflow-failure-digest` when local guidance artifacts are stale. Runtime drift and version repair views group missing helpers by owner surface so users can see whether install/update, context intelligence, learning evidence, release/shipping, or agent workflow files are affected before running `/update-forgeflow --repair`.
- **Validation planning:** `/forgeflow-validation-plan` maps changed files to focused tests, tells you when full suite or source smoke are required, and now exposes a single first-failure capture action before the full failed-command list.
- **Agent drift:** `/forgeflow-drift` and `check-agent-drift.js --json` compare consuming agent prompts against canonical shared intelligence sections and report MISSING/DRIFTED sections. They handle mode-specific Arbiter expectations and treat explicitly adapted sections as informational.
- **Context advisor:** `/forgeflow-context-advisor` wraps `advise-context.js --root .forgeflow --record --json` so users can see budget issues, low-savings packets, topology coverage signals, advisory trim plans, auto-trim advisor rollups, copy-ready next actions, review-wave suggestions, and previous-run trend deltas without calling the helper directly. Budget violations include target compact tokens, reduce-by estimates, safer focused-packet commands, and a stop rule so agents do not trim away raw-required failure evidence or proof files. The auto-trim advisor is advisory only: it does not edit context packets, remove proof files, or spawn agents. It prefers canonical `context/latest` telemetry when the same artifact also exists in the project context root.
- **Project trends:** `show-project-trends.js` summarizes the latest code-map trend, living project-map categories, import-gap status, artifact freshness, latest-insights readiness/freshness, latest failure-digest provenance/freshness, project-learning consumption, and advisor status from existing local artifacts. `/forgeflow-health-timeline` adds a chronological view over the same local signal family. `/forgeflow-report` uses the same helper when available.
- **Latest-insights state:** `latest-insights-state.js` provides the shared readiness/freshness check used by health, report, and trends so stale guidance is reported consistently.
- **Privacy boundary:** `privacy-boundary.js` centralizes sensitive-content detection, public-safe blocker normalization, and shell argument quoting for local learning, pilot, feedback, adoption, and implementation-note helpers.
- **Agent feedback rollup:** `rollup-agent-feedback.js` summarizes local `agent-feedback.jsonl` by reviewer, signal, promotable count, corrective count, skipped invalid/private lines, filtered advisory examples, correction themes, manual-promotion candidates, and stale markers.
- **Forgeflow report:** `render-forgeflow-report.js` combines local telemetry, false-positive thresholds, pattern-log freshness, context savings, project trends, import-gap status, latest-insights readiness/freshness, latest failure-digest status/freshness, and direct next-action recommendations into one Markdown or JSON report. Use `--refresh` to update project guidance first.
- **Release notes draft:** `render-release-notes.js` collects plugin version, matching changelog, recent commits, changed files, issue context from commit subjects, an optional local `{ "issues": [...] }` metadata file, optional release evidence JSON, dirty state, and release-gate commands into a public-safe Markdown or JSON release-note draft.
- **Release readiness blockers:** `render-release-readiness.js` classifies release preflight blockers as command failures, release-to-install preflight failures, allowlist issues, missing commands, missing release-check source, or execution-environment blockers such as restricted nested process spawning. Execution-environment blockers should be cleared by running the listed release-check command directly in the same trusted local environment used for release validation, or by rerunning readiness where local process spawning is permitted.
- **Post-publish verification:** `/forgeflow-release-verify` prints the shareable local post-publish summary for plugin version, local tag, changelog, release-note draft, source smoke, update smoke, installed-runtime dogfood, installed-version, and runtime-drift evidence. `/forgeflow-release-readiness --post-publish` keeps the full evidence block. Both are advisory and do not tag, push, publish, call GitHub, or mutate installed files.
- **Docs drift report:** `test-doc-links.js --report` renders a human-readable drift report for README, hosted docs, wiki home, release process, release gate, local links, changelog pointers, and release-check command parity.
- **Smoke check:** `/forgeflow-smoke` and `smoke-check.js` default to downstream readiness checks for health, trends refresh, report refresh, and code map. Warn/fail checks include reason, evidence, clearing guidance, and next actions in JSON and Markdown. Use `--mode source` for source-tree release guards plus packaged and installed-runtime dogfood self-tests, or `--mode full` for both groups.
- **Support bundle:** `/forgeflow-support` writes a local support/debug bundle with version, health, smoke, plan-only release readiness with post-publish verification, code-map acceptance health, docs drift, project trends, a snippet-free redaction preview, and consolidated next actions under `.forgeflow/<project>/support/`. It may include local paths, so use the preview categories as a starting point and redact before sharing outside the trusted project/team context.
- **Pilot script:** `render-pilot-script.js` prints a maintainer trial script by default and a first-real-task new-user path with `--path new-user`. Both paths cover install/readiness checks, project guidance, one bounded work item, review, evidence capture, rollup, and a public-safe result template. The new-user path is state-aware: it includes guided repair, release-readiness preview, project intelligence, living project-map status, and agent-feedback signal checks before the first task decision. `/forgeflow-first-useful-win` now also prints a runtime-specific first-use path for Claude Code slash commands or Codex/source `node scripts/forgeflow/...` commands.
- **Adoption pack:** `render-adoption-pack.js` gives net-new users a concise fit guide, first-trial path, existing pilot-evidence rollup, recommended action, owner lane, blocker, public-safe summary, small-team handoff checklist, proof boundary, and repeat/expand/fix/defer decision rubric. Pilot rollups now explain the decision using setup friction, project-intelligence readiness, living project-map status, and agent-feedback signal.
- **Learning status and pattern learnings:** `/forgeflow-learning-status` summarizes local learning health across project learnings, user profile, agent feedback, review outcomes, next-work outcomes, first-run results, and the project operating model, grouped into fix-first, watch, healthy lanes, and signal-quality scores. `/forgeflow-learning-action` turns the weakest learning or telemetry source into one concrete local capture/check command before agents rely on calibration, and `/forgeflow-learning-capture-nudge` gives the exact capture command to run after review, next-work, agent-feedback, or first-run events without inventing observed values. Learning status includes the local outcome-capture plan, workflow-ending capture prompts, trusted-source/weakest-source rollups, and a single next quality action so missing or low-trust calibration streams show what to refresh. Signal quality includes configurable age and reinforcement decay from `/forgeflow-learning-policy`, so old or sparse guidance loses trust unless recent evidence reinforces it; `/forgeflow-learning-policy --compare <json>` previews a proposed policy without writing it. Next-work outcomes include confidence-band calibration so recorded usefulness can be compared with predicted confidence. `/forgeflow-health-timeline` shows the same local signal family over time. `/forgeflow-pattern-review` shows dry-run pattern promotion candidates with a redaction checklist and no-auto-promotion boundary. `rollup-pattern-learnings.js` scans cross-project `.forgeflow/<project>/learnings.jsonl` plus `project-learning-candidates.jsonl`, clusters known/candidate patterns with source-mix labels, marks manual promotion candidates, and records `.learnings-log.jsonl` for `/forgeflow-report`.
- **Telemetry quality:** `/forgeflow-telemetry-quality` summarizes local metrics events, review outcomes, agent feedback, and next-work outcomes so calibration surfaces can say when evidence is ready or still sparse. It now uses the same trust vocabulary as learning status: trusted sources, weakest sources, confidence, and one next quality action. It is advisory and does not backfill, infer, or export private records.

- **Command and review evidence safety:** `/forgeflow-command-args` validates a small command-argument subset against an explicit allowlist without executing anything. `/forgeflow-review-evidence-schema --findings <json>` checks review finding shape, multi-file findings, path hazards, and obvious safety hazards before `/forgeflow-review-auto-classify` or `/forgeflow-review-auto-evidence` consumes captured findings.
- **Next-action, output, and review-auto safety checks:** `/forgeflow-next-action-audit` keeps helper `next` fields copy-pastable by pushing explanation into `next_reason`, `/forgeflow-output-contract` spot-checks representative helper output for status, next, reason, and boundary fields, and its optional `--lean-file <path>` check warns on overlong lean handoffs without truncating raw-required evidence. `/forgeflow-review-auto-classify --findings <json>` previews safe, risky, and blocker finding buckets before `/review-auto`, and `/forgeflow-review-auto-evidence --findings <json>` writes a local evidence artifact for the classification. The classifier now includes an explicit Phase 4 policy contract: allowlisted single-file classes can become future sandbox proposal candidates, unknown classes stay risky, and denylisted surfaces such as auth, permissions, secrets, migrations, dependencies, release publishing, settings files, broad behavior changes, or product judgment are not auto-applicable. `/forgeflow-review-autofix-sandbox --proposal <json>` is the Phase 5 proposal runner: it copies the checkout into an isolated temp sandbox, applies explicit deterministic proposal operations there, runs declared focused validation there, and writes `proposal.json`, `proposal.md`, and `proposal.diff` under `.forgeflow/<project>/review-auto/proposals/` without mutating the source checkout. Phase 6 adds deterministic exact-replacement proposal builders for docs/reference, command-wrapper parity, manifest/runtime-helper parity, and fixture-expectation drift, plus `/forgeflow-review-autofix-apply --proposal <json>` to apply one selected validated proposal after tracked-worktree, source-match, and validation checks. Phase 7 adds `/forgeflow-review-autofix-status` to summarize proposal inputs, sandbox proposals, apply artifacts, apply history, failures, rollbacks, and the next safe action. Failed apply validation rolls back the changed file and records local evidence; the path never commits, pushes, publishes, calls GitHub, dispatches workers, or batches fixes.
- **Context contract enforcement:** `/forgeflow-context-contract` checks generated agent packets against `agent-context-contract.json`, required packet sections, section-size limits, and advisory-boundary wording before agents rely on local learning guidance.
- **Runtime drift snapshot:** `/forgeflow-runtime-drift` compares managed source runtime helpers against installed runtime helpers, including missing helpers, content drift, mode drift, and syntax failures. It is read-only, recommends `/update-forgeflow --repair` for actionable drift, classifies mode-only drift as informational, and supports `--preview-repair` to show the exact managed repair actions without mutating installed files.

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

The pilot script prints the bounded trial path and public-safe result template. The recorder normalizes state-aware evidence fields for project-intelligence readiness, living project-map status, and agent-feedback signal before refreshing the rollup. The rollup stays local under `.forgeflow/<project-name>/` and summarizes pilot count, support categories, findings, review minutes, and the next recommended action.

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

Project learning rollups use:

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

Use `scripts/forgeflow/build-project-intelligence.js --next-work` when you only want the compact human-readable next-work candidates, or `scripts/forgeflow/build-project-intelligence.js --brief 1` to render an advisory implementation-brief stub for the first candidate. The stub includes scope-to-confirm, start-with, avoid-first, validate-with, suggested review lanes, implementation-notes seed prompts, a handoff checklist, and proof-boundary guidance. The rollup includes Git provenance, explicit readiness (`ready`, `needs-refresh`, `needs-triage`, or `blocked`), a next-work brief, advisory next-work item candidates, and a review-prep section that separates runnable refresh commands, advisory notes, first reads, and validation targets. The next-work brief gives the next implementer compact read-first, avoid-first, validate-first, and proof-boundary guidance. The next-work items turn readiness, risk, feedback, and review-prep signals into candidate slices with start and validation hints, while first-run missing failure digests remain informational until real failure output exists. When no stronger signal exists on a first-run project, the fallback points at `/forgeflow-first-run`, `/forgeflow-code-map`, health, and trends before implementation. It refreshes project learnings and compact code-map context before synthesis unless `--refresh` already refreshed trends and project guidance. Treat it as a compact orientation layer over the raw trends, topology, failure-digest, feedback, and project-learning artifacts.

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

`/forgeflow-trends` shows code-map trend, operating-model drift, living project-map categories, import-gap status, project-learning freshness, latest-insights readiness/freshness, latest failure-digest provenance/freshness, and context-advisor status in one compact project guidance health view. Use `/forgeflow-trends --refresh` to refresh project learnings and latest-insights readiness before rendering the view. When stale guidance is detected, the report recommends that refresh command directly.

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

It runs on `http://127.0.0.1:4003` and reads local telemetry files from both `~/.claude/projects/` and `~/.codex/projects/`. The dashboard also shows a Project Readiness panel backed by `GET /api/readiness`, with text-labeled status cards for project health, learning status, context budget, release readiness, dogfood report state, and dogfood refresh-plan readiness. The panel provides one copy-only next action and does not run commands, refresh artifacts, write files, spawn agents, call GitHub, or export telemetry.

For live agent-message observability, use `/agent-chat:on`, which runs a separate local dashboard on port `4001`. Stop it with `/agent-chat:off`. Forgeflow works without either dashboard.

## Team, CI, And Meta-Work

- `/forgeflow-sync` documents team-owned shared-state sync for selected Forgeflow state files while keeping `agent-notes/` per-user.
- `/ci-wrapper` documents the GitHub Actions PR-review wrapper, budget config, verdict JSON schema, rollout gates, and auth requirements.
- `/sync-upstream` syncs Forgeflow meta-work from `~/.claude/` back into this repo for maintainers.

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

Forgeflow is a local-first developer workflow for turning product intent into shipped code with explicit planning, implementation, review, verification, and release handoff. It targets Claude Code and Codex users who are comfortable installing command/agent files and running local scripts. The current build emphasizes operational confidence: guided repair, smoke automation, project intelligence, release-to-install preflight checks, pilot evidence, and targeted fixes from observed use.

## License

MIT. See [LICENSE](LICENSE).
