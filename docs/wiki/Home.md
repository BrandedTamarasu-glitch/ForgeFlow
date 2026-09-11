# ForgeFlow Wiki

**A software delivery workshop for Claude Code and Codex.**

ForgeFlow helps turn an idea into a scoped brief, working code, an evidence-backed review, and a shipping handoff. Specialist agents share useful project context, while the local dashboard shows reported activity, project readiness, and recorded review outcomes. Ember, the small robot at the forge, makes the current phase visible.

![The ForgeFlow workshop with Ember, project readiness, review outcomes, and live activity](../images/forgeflow-workshop.png)

## Start Here

1. **[Visual user guide](../user-guide.html)** or **[19-page PDF](../ForgeFlow-User-Guide.pdf)**: an illustrated end-to-end walkthrough. On GitHub, download the HTML and open it in your browser; its images and controls work offline.
2. **[Quick Start](Quick-Start.md)**: install into your host, enable the dashboard, and run one small task in your own project.
3. **[User Paths](User-Paths.md)**: choose a workflow for the outcome you need.
4. **[Dashboard and Ember](Dashboard.md)**: understand current activity, readiness, evidence, and empty states.

[Why ForgeFlow](Why-Forgeflow.md) explains the approach. [4.6.2 release notes](../changelogs/v4.6.2.html) describe the packaged version. This wiki follows the current source. The visual guide identifies its own source edition.

## New in 4.6.2

[Local shipping previews](Task-Evidence.md#local-shipping-previews) now include staged and unstaged edits and nonignored new files alongside committed changes, with one entry per path. Task validation remains tied to current evidence.

## Communication guidance from 4.6.1

The [communication guide](Agent-Roles.md#communication-with-the-user) explains the updated writing rules: audience-appropriate detail, useful progress updates, concrete examples, and clear validation limits. Exact technical details and structured output remain intact.

## Agent names introduced in 4.6.0

[Agent Roles](Agent-Roles.md) covers Builder, Guardian, Designer, Coordinator, Architect, Product Lead, and Verifier, with their phase responsibilities, host identifiers, and legacy-name mapping. CLI and dashboard messages carry explicit task context, and agent prompts include Orwell's six writing rules. History, context rebuild, cleanup and recovery fixes preserve compatibility across the rename.

For the first upgrade from legacy names, follow the [source-checkout procedure](../role-migration-upgrade.md). An old installed updater cannot apply the new preservation rules during its own update. Later releases use the newly installed helper.

## A First Useful Task

Use [Task Evidence and Recovery](Task-Evidence.md) to connect acceptance criteria, current proof, and resumable phase history across Claude Code and Codex.

| Step | Claude Code | Codex | Result |
|---|---|---|---|
| Design | `/consult` | `$consult` | A brief with scope and validation |
| Build | `/implement` | `$implement` | Working changes and focused checks |
| Review | `/review` | `$forge-review` | Findings supported by evidence |
| Ship | `/ship` | `$ship` | A reviewable handoff and shipping preparation |

Add a concrete task after the command and run one phase at a time. Request commits, pushes, PRs, or deployment explicitly. Codex's built-in `/review` is separate from ForgeFlow's `$forge-review`; the larger Claude slash-command catalog does not imply a matching Codex skill for every entry.

For a small task, start with `/quick` or `$quick`. For an uncertain direction, start with discuss, research, and plan. [Workflow Commands](Workflow-Commands.md) covers the full reference, and [Agent Roles](Agent-Roles.md) explains who does what.

## Install And Operate

- [Quick Start](Quick-Start.md), [Codex First Run](Codex-First-Run.md), [Template Installer](Template-Installer.md)
- [Settings and Recovery](Settings-And-Recovery.md), [Migration Guide](Migration-Guide.md)
- [Dashboard and Ember](Dashboard.md), [Local Data and Privacy](Local-Data-And-Privacy.md)
- [Demos](Demos.md), [Common Stack Examples](Common-Stack-Examples.md)

## Workflows And Project Context

- [User Paths](User-Paths.md), [Workflow Commands](Workflow-Commands.md), [Agent Roles](Agent-Roles.md)
- [Review Routing](Review-Routing.md), [Research Divergence](Research-Divergence.md)
- [Context Intelligence](Context-Intelligence.md), [Context Budget Examples](Context-Budget-Examples.md)
- [Optional Obsidian Vault Memory](Vault-Memory.md)
- [Implementation Notes](Implementation-Notes.md), [Project Learnings](Project-Learnings.md), [User Profile Guidance](User-Profile-Guidance.md)
- [Lean Quick Path](Lean-Quick-Path.md), [Lean Evidence](Lean-Evidence.md), [Lean Portability](Lean-Portability.md), [Telemetry Readiness](Telemetry-Readiness.md)

## Evaluate And Adopt

These are optional structured trials and evidence tools. You do not need a pilot report or benchmark to complete your first task.

- **Try it:** [Package Release Onboarding](Package-Release-Onboarding.md), [Branch Trial](Branch-Trial.md), [Maintainer Pilot](Maintainer-Pilot.md), [Adoption Pack](Adoption-Pack.md)
- **Decide as a team:** [Team Adoption Criteria](Team-Adoption-Criteria.md), [Team Privacy Boundaries](Team-Privacy-Boundaries.md), [Support Triage](Support-Triage.md), [CI and Headless Deferrals](CI-Headless-Deferrals.md)
- **Capture pilot evidence:** [Evidence Log](Pilot-Evidence-Log.md), [Public Summary](Pilot-Public-Summary.md), [Support Rollup](Pilot-Support-Rollup.md), [Adoption Comparison](Pilot-Adoption-Comparison.md), [Next Action Decision](Pilot-Next-Action-Decision.md)
- **Compare actual outcomes:** [Workflow Comparison](Workflow-Comparison.md), [Evaluation Sharing](Evaluation-Sharing.md), [Evaluation Summary Collection](Evaluation-Summary-Collection.md), [Public Examples](Public-Examples.md)
- **Improve onboarding:** [First Run Friction](First-Run-Friction.md), [Friction to Fix](Friction-To-Fix.md), [Field Validation](Field-Validation.md)

Record observed results. Missing optional evidence is not a failed installation, and an animation or live message is not proof that validation passed.

## Maintain And Release

- [Release Process](Release-Process.md), [Release Gate](Release-Gate.md), [Clean Checkout Install Verification](Clean-Checkout-Install-Verification.md)
- [Maintaining the Wiki](Maintaining-The-Wiki.md)
- [Roadmap](Roadmap.md)
- [Historical 4.3.0 release brief](Forgeflow-4.3-Release-Brief.md)

The editable source for these pages lives in [docs/wiki in the repository](https://github.com/BrandedTamarasu-glitch/ForgeFlow/tree/main/docs/wiki). The GitHub wiki is a separate published copy. Use the [documentation entry](../index.html) for a compact navigation page, or the [README](../../README.md) for the project overview.
