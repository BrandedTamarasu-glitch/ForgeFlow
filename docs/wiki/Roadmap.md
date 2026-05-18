# Roadmap

Forgeflow is currently a local-first developer workflow for Claude Code and Codex.

## Current Focus

Forgeflow now has the local install, health, repair, rollback, release, docs, demo, template-installer, and evaluation pieces needed for broader use. The next phase is adoption: making it easier to explain, trial, and compare Forgeflow on real branches.

## Adoption Work

- collect public-safe example outputs from install, health, review, evaluation, and context reports
- tighten first-run guidance for Codex users installing agents and skills from a local checkout
- keep evaluation records local-first while making aggregate summaries easy to share

## Recently Added

- Forgeflow rebrand and public README/wiki source
- Codex skills and local harness sync
- local review context packs
- memory indexing and compact memory context
- implementation scope manifests and per-agent packets
- context savings telemetry and summaries
- configurable context budgets and budget seeding
- project-local health repair helper
- context advisor with trimming recommendations and trend history
- `/forgeflow-version` status command and helper
- command coverage test and `/forgeflow-release-check`
- plugin manifest validation and clearer post-install verification
- short demo sessions for install, review, context advisor, repair, rollback, and release checks
- dashboard positioning for metrics vs live agent-chat observability
- context budget and trimming workflow examples
- common stack examples for frontend apps, APIs, Rails, Python, monorepos, docs, and release prep
- migration guide for existing local Claude installs
- static hosted documentation entry point under `docs/index.html`
- versioned release process and release-version drift check
- template installer for Claude Code and Codex
- local evaluation report generator for review outcome JSONL
- workflow comparison metrics for no-agent, single-agent, and Forgeflow reviews
- evaluation quality and efficiency rates for findings, false positives, review time, and auto-fix outcomes
- evaluation context savings and budget-violation metrics
- publishable lightweight evaluation summary format
- completed local-first evaluation tooling for review quality and context efficiency
- concise positioning for Review Squad and ad hoc agent review users
- branch trial guide for running Forgeflow without committing local state
