# Forgeflow Wiki

Forgeflow is an end-to-end AI software delivery workflow for Claude Code and Codex.

It coordinates focused agents across the full lifecycle:

```text
Discuss -> Research -> Plan -> Consult -> Implement -> Review -> Ship
```

## Start Here

- [Hosted Docs Entry](../index.html)
- [Why Forgeflow](Why-Forgeflow)
- [Quick Start](Quick-Start)
- [User Paths](User-Paths)
- [Workflow Commands](Workflow-Commands)
- [Codex First Run](Codex-First-Run)
- [Latest Tagged Release Notes](../changelogs/v4.3.72.html)
- [Release Process](Release-Process)
- [Local Data And Privacy](Local-Data-And-Privacy)

Older changelogs remain under `docs/changelogs/`.

## What Forgeflow Covers

- **Install, update, repair, and release:** `/update-forgeflow`, `/forgeflow-version`, `/forgeflow-health`, `/forgeflow-update-verify`, release readiness, release verification, release consumption, runtime drift, source smoke, and support bundles.
- **Lifecycle work:** `/discuss`, `/research`, `/plan`, `/consult`, `/implement`, `/review`, `/review-auto`, `/audit`, `/ship`, and `/handoff`.
- **Direct agent work:** `/quick`, `/create-agent`, `/debate`, `/fleet`, and `/ui-iterate`.
- **Context and review prep:** context packs, memory summaries, scope manifests, topology, budget checks, context advisor, focused review waves, failure digests, and noisy-command advice.
- **Project intelligence:** code maps, trends, project operating model, architecture docs, invocation hints, ownership map, dogfood report, and latest-insights injection.
- **Learning and telemetry:** project learnings, user operating profile, project experience profile, learning status, outcome capture, agent feedback, and local-only telemetry.
- **Dashboards and team surfaces:** the local metrics dashboard, the Project Readiness panel backed by `GET /api/readiness`, agent-chat, team-state sync guidance, and CI wrapper reference docs.

## Choose A Path

- New users: [Why Forgeflow](Why-Forgeflow), [Quick Start](Quick-Start), [User Paths](User-Paths), [Demos](Demos)
- Claude Code users: [Quick Start](Quick-Start), [Migration Guide](Migration-Guide), [Settings And Recovery](Settings-And-Recovery)
- Codex users: [Codex First Run](Codex-First-Run), [Quick Start](Quick-Start), [Review Routing](Review-Routing)
- Reviewers: [Review Routing](Review-Routing), [Context Intelligence](Context-Intelligence), [Project Learnings](Project-Learnings), [Implementation Notes](Implementation-Notes)
- Release owners: [Release Process](Release-Process), [Release Gate](Release-Gate), [Clean Checkout Install Verification](Clean-Checkout-Install-Verification), [Template Installer](Template-Installer)

## More Reference

- [Agent Roles](Agent-Roles)
- [Context Intelligence](Context-Intelligence)
- [Context Budget Examples](Context-Budget-Examples)
- [Common Stack Examples](Common-Stack-Examples)
- [Dashboard](Dashboard)
- [Lean Evidence](Lean-Evidence)
- [Lean Quick Path](Lean-Quick-Path)
- [Lean Portability](Lean-Portability)
- [Maintainer Pilot](Maintainer-Pilot)
- [Adoption Pack](Adoption-Pack)
- [Team Privacy Boundaries](Team-Privacy-Boundaries)
- [Support Triage](Support-Triage)
- [Roadmap](Roadmap)

## Core Idea

Forgeflow separates software delivery into phases with explicit responsibilities, so planning, implementation, validation, and final judgment do not collapse into one prompt.

The workflow adds local context intelligence and evidence tracking without requiring hosted telemetry. Helpers keep prompts smaller, preserve local project memory, and gate higher-risk automation on visible evidence.

## Agent Cast

- **Smith:** backend craft, data, code quality
- **Warden:** security, systems, reuse
- **Lumen:** UX, accessibility, connectivity
- **Atlas:** coordination and project memory
- **Arbiter:** architecture synthesis and verdicts
- **Compass:** product validation and requirements
- **Aegis:** neutral evidence verification
