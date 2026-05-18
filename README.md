# Forgeflow

Forgeflow is an end-to-end AI software delivery workflow for Claude Code and Codex. It turns a prompt or code change into a structured build cycle: discuss, research, plan, consult, implement, review, and ship.

Instead of one general-purpose assistant doing everything, Forgeflow uses a focused cast of agents with clear responsibilities, evidence standards, and handoff rules.

## Why Forgeflow

Most AI coding workflows collapse three different jobs into one prompt: deciding what to build, writing the code, and judging whether the result is safe to ship. Forgeflow separates those jobs.

- **Plan before coding:** discussion, research, and planning phases preserve product intent.
- **Use specialists where they help:** backend craft, security, UX, coordination, architecture, validation, and verification each get their own agent.
- **Keep verdicts grounded:** high-risk findings can pass through Aegis, an evidence-only verifier.
- **Explain routing decisions:** review mode records why agents were included or skipped.
- **Learn locally:** calibration and outcome records stay on your machine unless you choose to share them.

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
- `/implement` to execute a prepared brief.
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

## Local Metrics And Calibration

Forgeflow can summarize local review telemetry:

```bash
scripts/forgeflow/summarize-calibration.js --json
scripts/forgeflow/record-review-outcome.js --summary .forgeflow/<project>/review-outcomes.jsonl --json
```

These records are local-first. They are meant to help you understand false positives, verifier outcomes, accepted findings, review time, and auto-fix quality.

## Local Context Intelligence

Forgeflow includes local-only helpers that reduce agent prompt load before review or implementation work starts:

- **Context packs:** `build-context-pack.js` prepares bounded reviewer packets and a synthesis input file from the changed files.
- **Memory index:** `index-memory.js` indexes local Forgeflow memory so agents can use compact project history instead of reading full notes.
- **Memory context:** `build-memory-context.js` builds a compact memory summary for research, planning, consultation, and implementation.
- **Scope manifests:** `build-scope-manifest.js` creates file ownership packets for implementation waves.
- **Context telemetry:** context, memory, and scope helpers emit token estimates and savings telemetry.
- **Budget checks:** `check-context-budget.js` reads `.forgeflow-budget.json` and warns when compact context exceeds configured limits.
- **Health repair:** `health-check.js --fix --json` creates safe project-local scaffolding and seeds budget config when missing.
- **Context advisor:** `advise-context.js --root .forgeflow --record --json` reports budget issues, low-savings packets, trimming recommendations, and previous-run trend deltas.

Useful commands:

```bash
scripts/forgeflow/build-context-pack.js --json
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

## Dashboard

The dashboard is a local read-only HTTP server for metrics and agent chat observability:

```text
/dashboard
```

It runs on localhost and reads local telemetry files. It is optional; Forgeflow works without it.

## Documentation

- [Wiki source](docs/wiki/Home.md)
- [Context intelligence](docs/wiki/Context-Intelligence.md)
- [Codex migration notes](CODEX_MIGRATION.md)
- [Telemetry schema](docs/forgeflow-metrics-telemetry-schema.md)
- [Verdict JSON schema](docs/forgeflow-json-schema.md)
- [Evaluation protocol](docs/forgeflow-evaluation-protocol.md)

## Current Status

Forgeflow is a local-first developer workflow for turning product intent into shipped code with explicit planning, implementation, review, verification, and release handoff. It currently targets Claude Code and Codex users who are comfortable installing command/agent files and running local scripts. Hosted onboarding, marketplace packaging, and broader consumer polish are next.

## License

MIT. See [LICENSE](LICENSE).
