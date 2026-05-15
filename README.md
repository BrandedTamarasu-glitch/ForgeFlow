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

Bootstrap local state:

```bash
scripts/forgeflow/ensure-forgeflow-state.sh
```

Audit and repair project-local Forgeflow state:

```bash
scripts/forgeflow/health-check.js --fix --json
```

To seed a project-local context budget config without overwriting an existing file:

```bash
scripts/forgeflow/seed-budget-config.js --json
```

To inspect local context savings and get trimming recommendations:

```bash
scripts/forgeflow/advise-context.js --root .forgeflow --json
```

Run a first review from Claude Code:

```text
/review
```

Or from Codex:

```text
$forge-review review the current changes
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

## Dashboard

The dashboard is a local read-only HTTP server for metrics and agent chat observability:

```text
/dashboard
```

It runs on localhost and reads local telemetry files. It is optional; Forgeflow works without it.

## Documentation

- [Wiki source](docs/wiki/Home.md)
- [Codex migration notes](CODEX_MIGRATION.md)
- [Telemetry schema](docs/forgeflow-metrics-telemetry-schema.md)
- [Verdict JSON schema](docs/forgeflow-json-schema.md)
- [Evaluation protocol](docs/forgeflow-evaluation-protocol.md)

## Current Status

Forgeflow is a local-first developer workflow. It currently targets Claude Code and Codex users who are comfortable installing command/agent files and running local scripts. Hosted onboarding, marketplace packaging, and broader consumer polish are the next productization steps.

## License

MIT. See [LICENSE](LICENSE).
