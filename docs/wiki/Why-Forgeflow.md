# Why ForgeFlow

ForgeFlow is a software delivery workshop for Claude Code and Codex. It helps an individual developer or a team move from an uncertain idea to an implementation brief, working changes, an evidence-backed review, and a clear shipping handoff.

## What You Get

- **Specialist judgment:** agents cover backend craft, security, UX, coordination, architecture, and validation. Routing keeps the team proportional to the task.
- **A repeatable workflow:** enter at quick, consult, review, or an earlier discovery phase according to what the work needs.
- **Useful project context:** local notes, learnings, context packs, and budget guidance help later work start with relevant evidence. Current code and tests still decide correctness.
- **A visible workshop:** the local dashboard combines reported activity, project readiness, review outcomes, and trends. Ember tends the forge as phases change and settles into idle animation between tasks.
- **Reviewable results:** findings need evidence, validation is reported explicitly, and remote shipping actions require your instruction.

![ForgeFlow's local workshop dashboard](../images/forgeflow-workshop.png)

## How It Fits Your Host

| Surface | Claude Code | Codex |
|---|---|---|
| Main workflows | Slash commands such as `/consult` and `/review` | Skills such as `$consult` and `$forge-review` |
| Specialist agents | Claude agent definitions | Codex custom-agent definitions |
| Helpers and dashboard | Local runtime | Local runtime |
| Extended catalog | Larger slash-command reference | Installed skills plus explicitly invoked runtime helpers |

The hosts share the core delivery flow, but command names, settings, hooks, and available models differ. Start with [Quick Start](Quick-Start.md) and use [Workflow Commands](Workflow-Commands.md) as a reference when needed.

## Try It On One Real Task

Pick something small enough to judge: a missing empty state, a reproducible bug, or a bounded refactor. Run consult, implement, review, and ship one step at a time. Inspect the brief, the resulting diff, and the validation evidence. Use the [visual guide](../user-guide.html) or [PDF](../ForgeFlow-User-Guide.pdf) for the complete walkthrough.

The dashboard becomes more informative as actual work is recorded. A new installation can have no review history, no trends, and no optional benchmark evidence. Do not create sample outcomes to make those panels look complete.

## Boundaries

ForgeFlow keeps its workflow artifacts locally by default. Your coding host and model provider still have their own data handling and network behavior; see [Local Data and Privacy](Local-Data-And-Privacy.md). A dashboard status or animation represents reported state, not independent proof of success. Multiple agents do not guarantee better results, and context savings estimates are not provider billing measurements.

For a structured comparison, [Workflow Comparison](Workflow-Comparison.md) explains how to compare actual reviews on the same change. [Branch Trial](Branch-Trial.md) and the [Adoption Pack](Adoption-Pack.md) are optional tools for a broader evaluation.

## Where It Came From

ForgeFlow grew from Review Squad's specialist-review approach. Review remains central, while the current product also supports planning, implementation, validation, project memory, and the local workshop. The [historical 4.3.0 release brief](Forgeflow-4.3-Release-Brief.md) records an earlier milestone; the [README](../../README.md) describes the current product.
