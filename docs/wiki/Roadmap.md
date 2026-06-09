# Roadmap

Forgeflow is currently a local-first developer workflow for Claude Code and Codex.

## Current Focus

Forgeflow now has the local install, health, repair, rollback, release, docs, demo, template-installer, evaluation, adoption, field-validation, distribution-readiness, team-trial guidance, learning path, code topology, project trends, project intelligence, release-to-install preflight, and report surfaces needed for broader use. The current phase is evidence-driven stabilization: run bounded maintainer trials, keep smoke and release checks green, collect public-safe summaries, and make targeted fixes from observed evidence.

## Planned Deferred Work

The next selected deferred work items are the two safest high-value extensions:

1. Visual dashboard expansion.
2. Cross-project/org operating model.

Both tracks stay local-first and advisory. They do not introduce GitHub mutation, PR comments, CI auto-push, LLM-generated patching, multi-fix batches, or automatic promotion.

### Phase 14: Dashboard Evidence API

Add a read-only dashboard data aggregator for project health, learning status, context budget, release readiness summary, dogfood report status, and dogfood refresh-plan next action. The endpoint should read existing local artifacts and helper outputs only. It must not refresh artifacts, write files, spawn agents, call GitHub, or export telemetry.

### Phase 15: Dashboard UI Panel

Add a compact Project Readiness panel to the optional local dashboard. The panel should show status badges, stale-evidence warnings, and copyable next commands. It should remain dense, keyboard accessible, responsive, and readable without relying on color alone. It must not run shell commands or mutate local state.

### Phase 16: Cross-Project Source Inventory

Add a read-only helper that inventories trusted local Forgeflow project artifacts across explicit roots or known Forgeflow state locations. It should summarize available project operating models, learning rollups, dogfood reports, trends, freshness, skipped projects, and privacy blockers without scanning broad home directories by default.

### Phase 17: Cross-Project Operating Model Rollup

Aggregate repeated validation norms, risk zones, high-care surfaces, repeated blockers, and confidence by evidence source into an advisory org-level operating model. It should use counts, freshness, and public-safe summaries rather than raw project details.

### Phase 18: Cross-Project Model Display And Context Hook

Add a `/forgeflow-org-model` display command and, only if compact and quality-gated, optional context-pack injection. The guidance must remain verify-before-use and cannot override current project evidence, user instructions, security requirements, accessibility requirements, or product judgment.

### Still Deferred

Full runtime call graph, CODEOWNERS/GitHub ownership sync mutation, LLM-generated patching, PR comment bots, CI auto-push, multi-fix batches, hosted dashboard, and telemetry export remain out of scope for this track.

## Pilot Evidence Collection Work

No new broad feature track is currently selected. Remaining work should stay inside the phases below unless pilot evidence exposes a higher-priority gap.

## Stabilization Plan

### Phase 1: Current-State Refresh And Smoke

Goal: make the local Forgeflow install and project guidance current after every pushed slice.

Work items:
- Run `/forgeflow-health`.
- Run `/forgeflow-trends --refresh`.
- Run `/forgeflow-report --refresh`.
- Run `/forgeflow-code-map`.
- Confirm latest insights are current for `HEAD`.
- Confirm context budget is passing or has a concrete trim recommendation.
- Confirm import-gap counts are visible in trends and report.

Exit criteria:
- Health passes or has one documented manual setting fix.
- Trends/report have no stale-guidance recommendation after refresh.
- Any remaining recommendation points to a real follow-up command.

### Phase 2: Smoke Automation

Goal: turn the manual smoke path into one repeatable local check.

Work items:
- Add a helper that runs health, trends refresh, report refresh, code map, doc links, and release-version guard.
- Emit compact JSON and Markdown summaries.
- Add a test for pass/fail aggregation and command failure reporting.
- Document when to run the smoke helper before commit, before push, and before a pilot.

Exit criteria:
- One command can prove the local install, docs, project guidance, report, and code-map surfaces are coherent.
- Failures include the exact next command or file to inspect.

### Phase 3: Pilot Script And Evidence

Goal: make a maintainer trial easy to run without inventing steps during the session.

Work items:
- Create a short pilot script that covers install verification, health, trends, report, code map, one work item, and final report.
- Add a public-safe result template for Zach/user feedback.
- Record pilot evidence with the existing evidence helpers.
- Roll up repeated friction categories after each trial.

Exit criteria:
- A new maintainer can run the pilot without reading the whole wiki.
- The output clearly says repeat, expand, stop-and-fix, or defer.

### Phase 4: Targeted Hardening

Goal: fix only issues observed by smoke runs or pilots.

Candidate fixes:
- Add a clearer topology scope setting when users want production-only maps.
- Tighten health output so Claude/Codex install problems point to one repair path.
- Trim any report sections that repeat the same recommendation in multiple places.

Exit criteria:
- Each hardening item is backed by a smoke failure, pilot note, or repeated user confusion.
- No speculative helper is added without evidence.

### Phase 5: Packaging And Freeze

Goal: stop feature churn and prepare for broader use.

Work items:
- Run the full release-check list.
- Run clean-checkout install verification for Claude and Codex.
- Update README, Home, Roadmap, Context Intelligence, Workflow Commands, and Release Process.
- Tag the stabilized release only after smoke and pilot evidence are green.

Exit criteria:
- Docs describe the actual user path.
- Release checks and smoke checks pass from a clean checkout.
- Remaining work is tracked as evidence-driven follow-up, not hidden TODOs.

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
- team adoption criteria for repeat, expand, stop-and-fix, and defer decisions
- CI and headless-review deferral guidance gated on team-trial demand
- completed team-trial readiness guidance for pilots, privacy, support triage, adoption criteria, and CI deferrals
- pilot evidence log for capturing one real maintainer trial without exposing raw local state
- project intelligence readiness, review-prep, next-work brief, and advisory next-work item candidates
- agent-feedback rollup and manual promotion path into project-learning candidates
- release-to-install preflight in release readiness for managed runtime helper source checks
- updater partial-repair bootstrap handling for installs missing newer helper dependencies
- normalized state-aware pilot evidence fields for project-intelligence readiness, living project-map status, and agent-feedback signal
- pilot public-summary runbook for privacy-gated aggregate evidence from real trials
- pilot support rollup for repeated blocker categories across maintainer trials
- pilot adoption comparison worksheet for repeat, expand, stop-and-fix, and defer decisions
- pilot next-action decision record for product-fix, another-pilot, small-team-expansion, or continued-deferral outcomes
- project learning path through health, trends, report, latest-insights packets, and direct refresh recommendations
- project code-map import-gap explanations with trends/report recommendations
- local smoke helper and `/forgeflow-smoke` for repeatable stabilization checks
- maintainer pilot script helper and `/forgeflow-pilot` for bounded trial setup, evidence capture, rollup, and public-safe result templates
