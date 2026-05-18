# Roadmap

Forgeflow is currently a local-first developer workflow for Claude Code and Codex.

## Current Focus

Forgeflow now has the local install, health, repair, rollback, release, docs, demo, template-installer, evaluation, adoption, field-validation, and distribution-readiness guidance needed for broader use. The next phase is team trial readiness: preparing a small-team rollout path with clear success criteria, privacy boundaries, support triage, and evidence collection.

## Team Trial Readiness Work

- Capture adoption criteria for when a trial is ready to expand beyond one maintainer.
- Decide which CI or headless-review ideas stay deferred until team trials show demand.

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
- public-safe example outputs for install, health, review, context, and evaluation reports
- Codex first-run guidance for installing agents and skills from a local checkout
- local-first evaluation sharing guidance for aggregate public summaries
- field validation plan for branch trials across representative project types
- evaluation summary collection workflow for real-review field validation
- workflow comparison guide for no-agent, single-agent, and Forgeflow reviews
- first-run friction log for Claude Code and Codex field validation
- friction-to-fix playbook for turning repeated field-validation issues into targeted changes
- completed field-validation guidance for trials, comparisons, friction logging, and targeted fixes
- clean-checkout install verification guide for Claude Code and Codex release handoff
- release metadata alignment checks for plugin, marketplace, README, and hosted release notes
- package and release onboarding guide for new users arriving from public distribution surfaces
- release gate guide tying release checks to public-summary examples before tagging
- release-facing settings and recovery guide for manual wiring, restarts, repair, and rollback
- completed distribution-readiness guidance for install verification, metadata alignment, onboarding, release gates, and recovery
- maintainer pilot checklist for the first small-team trial on a real branch
- team privacy boundaries for local state, private-team sharing, and public-safe summaries
- support triage guide for install, health, routing, context, and review-quality issues
