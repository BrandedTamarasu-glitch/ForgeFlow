# Roadmap

Forgeflow is a local-first workflow for Claude Code and Codex. This page tracks current product direction, not one maintainer session or one release cut.

## Current Priorities

1. Keep install, repair, and release paths trustworthy.
2. Keep review, audit, and context-prep surfaces evidence-backed.
3. Reduce onboarding friction for Claude Code and Codex without broadening automation risk.
4. Keep public docs and runtime behavior aligned.

## Active Work Themes

### Install And Runtime Confidence

- Keep `/update-forgeflow`, `/forgeflow-version`, `/forgeflow-health`, `/forgeflow-update-verify`, and runtime-drift checks aligned.
- Preserve explicit manual boundaries for host settings and rollback.
- Treat Claude and Codex helper parity as a release requirement.

### Review And Context Quality

- Keep review routing explainable and deterministic.
- Improve context-pack quality, budget guidance, and review-wave follow-through.
- Use Aegis verification and release-readiness warnings to keep high-risk claims grounded.

### Onboarding And Adoption Evidence

- Keep first-run, pilot, and support surfaces compact enough for real users to follow without internal maintainer context.
- Prefer public-safe summaries and aggregate evidence over raw local state.
- Fix repeated friction before adding new workflow surface area.

### Release And Documentation Discipline

- Keep README, wiki, hosted docs, changelog pointers, and release metadata in sync.
- Avoid count-based or host-specific claims that drift easily.
- Prefer current user paths over internal phase history.

## Deferred By Default

The following stay out of scope unless new evidence justifies them:

- hosted telemetry or remote analytics
- automatic GitHub or PR mutation
- CI auto-push or auto-merge behavior
- broad LLM-generated patching
- multi-fix autobatching across unrelated findings
- full runtime call-graph claims

## How To Prioritize New Work

- Prefer fixes backed by smoke failures, release-readiness failures, pilot evidence, or repeated user confusion.
- Prefer smaller changes that improve install confidence, review correctness, or docs accuracy.
- Defer speculative helpers when an existing command or document already covers the need.
