# Roadmap

Forgeflow is currently a local-first developer workflow for Claude Code and Codex.

## Near Term

### Phase 1: Version And Release Status

- add `/forgeflow-version` for installed SHA, upstream `main`, latest release, helper paths, and next action
- expose a JSON mode so health checks, docs, and future support scripts can consume the same status
- use it during smoke tests before deeper health checks

### Phase 2: Onboarding Diagnostics

- make `/forgeflow-health` first-run output more prescriptive
- detect non-git directories and suggest running from a real project path
- print exact manual settings snippets for hook and statusline wiring drift
- distinguish "installed but Claude needs restart" from missing files

### Phase 3: Install Repair And Rollback

- add update repair mode for missing or corrupted managed files
- preserve one previous managed-file snapshot before update
- add rollback command or flag that restores the previous snapshot without touching custom agents
- keep `settings.json` manual by default, with explicit opt-in only if a settings mutator is ever added

### Phase 4: Command Coverage Tests

- add manifest coverage checks for every installed slash command
- validate command frontmatter, helper references, and installed-path assumptions
- run representative no-network smoke tests for install, health, version, metrics, and context helpers
- add a release checklist command that runs the command coverage suite before tagging

### Consumer Polish

- improve plugin packaging
- add screenshots or short demos
- tighten dashboard positioning for consumer users
- expand examples for context budgets and trimming workflows

## Productization

- hosted documentation site
- template installer for Claude Code and Codex
- clearer migration path from existing local installs
- improved examples for common stacks

## Evaluation

- collect anonymized review outcome records
- compare no-agent, single-agent, and Forgeflow reviews
- measure false positives, accepted findings, review time, and auto-fix quality
- measure context-pack savings and budget violations across real projects
- publish a lightweight evaluation report when enough data exists

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
