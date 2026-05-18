# Forgeflow Wiki

Forgeflow is an end-to-end AI software delivery workflow for Claude Code and Codex.

It coordinates a set of focused agents across the full build lifecycle:

```text
Discuss -> Research -> Plan -> Consult -> Implement -> Review -> Ship
```

## Start Here

- [Quick Start](Quick-Start)
- [Demos](Demos)
- [Dashboard](Dashboard)
- [Agent Roles](Agent-Roles)
- [Workflow Commands](Workflow-Commands)
- [Review Routing](Review-Routing)
- [Context Intelligence](Context-Intelligence)
- [Context Budget Examples](Context-Budget-Examples)
- [Common Stack Examples](Common-Stack-Examples)
- [Migration Guide](Migration-Guide)
- [Local Data And Privacy](Local-Data-And-Privacy)
- [Roadmap](Roadmap)

## Core Idea

Forgeflow separates software delivery into phases and assigns each phase to agents with explicit responsibilities. This keeps planning, implementation, validation, and final judgment from collapsing into one overbroad prompt.

The current build also adds local context intelligence: bounded context packets, compact memory summaries, scope manifests, context telemetry, budget checks, health repair, and trend-aware context recommendations. These helpers keep agent prompts smaller while preserving the local project memory needed for end-to-end work.

## Agent Cast

- **Smith:** backend craft, data, code quality
- **Warden:** security, systems, reuse
- **Lumen:** UX, accessibility, connectivity
- **Atlas:** coordination and project memory
- **Arbiter:** architecture synthesis and verdicts
- **Compass:** product validation and requirements
- **Aegis:** neutral evidence verification
