# Why Forgeflow

Forgeflow is for teams that have outgrown one-shot AI review and want a local-first workflow that can plan, implement, review, verify, and ship with measurable outcomes.

## From Review Squad

Review Squad proved that specialist agents are useful, but it focused mostly on review. Forgeflow keeps the specialist model and adds the operating system around it:

- lifecycle commands from discussion through ship
- deterministic review routing with skip, thin, full, and deep modes
- Aegis verification for high-risk or noisy findings
- local context packs, memory summaries, scope manifests, and budget checks
- install, health, repair, rollback, release, and evaluation helpers
- Codex-native agents and skills alongside Claude Code commands

## From Ad Hoc Agent Review

Ad hoc agent review is quick, but it is hard to compare runs, recover from install drift, or tell whether quality is improving. Forgeflow gives those reviews structure:

- agents have clear roles and evidence standards
- routing records why each agent was included or skipped
- context helpers reduce prompt load before agents read files directly
- outcome records track accepted findings, false positives, review time, auto-fix results, and regressions
- public summaries can share aggregate results without raw code or private telemetry

## What Changed For Codex

Forgeflow now ships with Codex agent definitions, Codex skills, and a local template installer. A checkout can seed Claude Code, Codex, or both:

```bash
node scripts/forgeflow/install-template.js --target both
```

Codex users can run the same lifecycle through skills:

```text
$discuss -> $research -> $plan -> $consult -> $implement -> $forge-review -> $ship
```

## Why Try It Now

The current build is no longer only a multi-agent review experiment. It includes:

- `/forgeflow-version` for install status and upstream drift
- `/forgeflow-health` for install and project-local diagnostics
- `/update-forgeflow --repair` and `--rollback` for recovery
- `/forgeflow-release-check` and `/forgeflow-release-readiness` for pre-release validation and release-to-install preflight checks
- context savings and budget reports
- project intelligence with readiness, review-prep, next-work briefs, and advisory next-work candidates
- pilot evidence with normalized state-aware fields and public-safe adoption summaries
- evaluation reports with workflow comparison, quality rates, and public-safe summaries

Run it on one real branch and compare the result against no-agent or single-agent review. Forgeflow is designed to make that comparison visible instead of relying on vibe.
