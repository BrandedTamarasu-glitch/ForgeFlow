# Forgeflow Wiki

Forgeflow is an end-to-end AI software delivery workflow for Claude Code and Codex.

It coordinates a set of focused agents across the full build lifecycle:

```text
Discuss -> Research -> Plan -> Consult -> Implement -> Review -> Ship
```

## Start Here

- [Hosted Docs Entry](../index.html)
- [Why Forgeflow](Why-Forgeflow)
- [Forgeflow 4.3.8 Patch Notes](../changelogs/v4.3.8.html)
- [Forgeflow 4.3.7 Patch Notes](../changelogs/v4.3.7.html)
- [Forgeflow 4.3.6 Patch Notes](../changelogs/v4.3.6.html)
- [Forgeflow 4.3.5 Patch Notes](../changelogs/v4.3.5.html)
- [Forgeflow 4.3.4 Patch Notes](../changelogs/v4.3.4.html)
- [Forgeflow 4.3.3 Patch Notes](../changelogs/v4.3.3.html)
- [Forgeflow 4.3.2 Patch Notes](../changelogs/v4.3.2.html)
- [Forgeflow 4.3.1 Patch Notes](../changelogs/v4.3.1.html)
- [Forgeflow 4.3 Release Brief](Forgeflow-4.3-Release-Brief.md)
- [Project Learnings](Project-Learnings)
- [Maintainer Pilot](Maintainer-Pilot)
- [Team Privacy Boundaries](Team-Privacy-Boundaries)
- [Support Triage](Support-Triage)
- [Team Adoption Criteria](Team-Adoption-Criteria)
- [CI And Headless Deferrals](CI-Headless-Deferrals)
- [Pilot Evidence Log](Pilot-Evidence-Log)
- [Pilot Public Summary](Pilot-Public-Summary)
- [Pilot Support Rollup](Pilot-Support-Rollup)
- [Pilot Adoption Comparison](Pilot-Adoption-Comparison)
- [Pilot Next Action Decision](Pilot-Next-Action-Decision)
- [Branch Trial](Branch-Trial)
- [Public-Safe Examples](Public-Examples)
- [Package And Release Onboarding](Package-Release-Onboarding)
- [Evaluation Sharing](Evaluation-Sharing)
- [Evaluation Summary Collection](Evaluation-Summary-Collection)
- [Workflow Comparison](Workflow-Comparison)
- [First-Run Friction](First-Run-Friction)
- [Friction To Fix](Friction-To-Fix)
- [Field Validation](Field-Validation)
- [Clean Checkout Install Verification](Clean-Checkout-Install-Verification)
- [Quick Start](Quick-Start)
- [User Paths](User-Paths)
- [Codex First Run](Codex-First-Run)
- [Demos](Demos)
- [Dashboard](Dashboard)
- [Agent Roles](Agent-Roles)
- [Workflow Commands](Workflow-Commands)
- [Implementation Notes](Implementation-Notes)
- [Review Routing](Review-Routing)
- [Context Intelligence](Context-Intelligence)
- [Context Budget Examples](Context-Budget-Examples)
- [Common Stack Examples](Common-Stack-Examples)
- [Migration Guide](Migration-Guide)
- [Settings And Recovery](Settings-And-Recovery)
- [Release Process](Release-Process)
- [Release Gate](Release-Gate)
- [Template Installer](Template-Installer)
- [Local Data And Privacy](Local-Data-And-Privacy)
- [Roadmap](Roadmap)

## Core Idea

Forgeflow separates software delivery into phases and assigns each phase to agents with explicit responsibilities. This keeps planning, implementation, validation, and final judgment from collapsing into one overbroad prompt.

The current build also adds local context intelligence: bounded context packets, compact memory summaries, scope manifests, context telemetry, budget checks, health repair, smoke checks, pilot scripts, and trend-aware context recommendations. These helpers keep agent prompts smaller while preserving the local project memory needed for end-to-end work. Local artifact reads and writes reject symlinks, include untracked work in generated context, and can fail CI when context budgets are exceeded.

Forgeflow also carries implementation context and pilot evidence forward. `/implement` maintains local implementation notes, `/ship` checks and summarizes those notes, `/forgeflow-smoke` verifies the local stabilization path, and `/forgeflow-pilot` prints a bounded maintainer-trial script with evidence capture and support/adoption rollups under `.forgeflow/<project-name>/`.

Project learnings are the next local memory layer: a durable, user-editable summary of recurring pitfalls, stable decisions, risk areas, validation patterns, and recommended approaches across work items. Agents can use that file as guidance in later phases while still verifying current code and artifacts.

## Agent Cast

- **Smith:** backend craft, data, code quality
- **Warden:** security, systems, reuse
- **Lumen:** UX, accessibility, connectivity
- **Atlas:** coordination and project memory
- **Arbiter:** architecture synthesis and verdicts
- **Compass:** product validation and requirements
- **Aegis:** neutral evidence verification
