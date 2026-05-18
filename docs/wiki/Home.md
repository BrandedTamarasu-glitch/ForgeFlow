# Forgeflow Wiki

Forgeflow is an end-to-end AI software delivery workflow for Claude Code and Codex.

It coordinates a set of focused agents across the full build lifecycle:

```text
Discuss -> Research -> Plan -> Consult -> Implement -> Review -> Ship
```

## Start Here

- [Hosted Docs Entry](../index.html)
- [Why Forgeflow](Why-Forgeflow)
- [Maintainer Pilot](Maintainer-Pilot)
- [Team Privacy Boundaries](Team-Privacy-Boundaries)
- [Support Triage](Support-Triage)
- [Team Adoption Criteria](Team-Adoption-Criteria)
- [CI And Headless Deferrals](CI-Headless-Deferrals)
- [Pilot Evidence Log](Pilot-Evidence-Log)
- [Pilot Public Summary](Pilot-Public-Summary)
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
- [Codex First Run](Codex-First-Run)
- [Demos](Demos)
- [Dashboard](Dashboard)
- [Agent Roles](Agent-Roles)
- [Workflow Commands](Workflow-Commands)
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

The current build also adds local context intelligence: bounded context packets, compact memory summaries, scope manifests, context telemetry, budget checks, health repair, and trend-aware context recommendations. These helpers keep agent prompts smaller while preserving the local project memory needed for end-to-end work.

## Agent Cast

- **Smith:** backend craft, data, code quality
- **Warden:** security, systems, reuse
- **Lumen:** UX, accessibility, connectivity
- **Atlas:** coordination and project memory
- **Arbiter:** architecture synthesis and verdicts
- **Compass:** product validation and requirements
- **Aegis:** neutral evidence verification
