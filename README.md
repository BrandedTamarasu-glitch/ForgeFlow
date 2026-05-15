# Forgeflow — Claude Code Sub-Agents

A 6-agent end-to-end AI software delivery workflow for [Claude Code](https://claude.com/claude-code). The Forgeflow team covers the full development lifecycle from discussion through shipping, with specialized agents handling code quality, security, UX, program management, architectural oversight, and product management.

## Codex Quickstart

This repo now includes a Codex-native port alongside the original Claude-oriented assets.

Codex uses three main surfaces here:

- `.codex/agents/` for project-scoped custom subagents
- `.agents/skills/` for workflow entry points
- `scripts/forgeflow/` for direct helper scripts

The recommended Codex lifecycle is:

```text
$discuss -> $research -> $plan -> $consult -> $implement -> $forge-review -> $ship
```

If you want the shortest path, start at `$consult` for approach design or `$forge-review` for a multi-agent review.

### First Session

Run the state bootstrapper first:

```bash
scripts/forgeflow/ensure-forgeflow-state.sh
```

Then use the skill aliases in Codex:

```text
$discuss add a Codex quickstart section to the README
$research evaluate the best placement and examples
$plan create the implementation plan
$consult produce the implementation brief
$implement execute the brief
$forge-review review the doc changes
$ship prepare the branch for merge
```

### Skills vs Scripts

Skills are the primary Codex interface:

- `discuss`
- `research`
- `plan`
- `consult`
- `implement`
- `forge-review`
- `ship`
- `aegis-verify`

Helper scripts are direct operational tools:

```bash
scripts/forgeflow/ensure-forgeflow-state.sh
scripts/forgeflow/ship-prepare.sh "Optional title"
```

`agent-chat` is optional observability tooling, not part of the normal path:

```bash
scripts/forgeflow/agent-chat-on.sh
scripts/forgeflow/agent-chat-off.sh --copy-default
```

It is local-only and setup-dependent.

### Where State Lives

Forgeflow persists workflow artifacts under:

```text
.forgeflow/<project-name>/
```

That directory stores discussion, research, plan, brief, review history, learnings, agent notes, and generated ship artifacts.

### Mapping Note

Claude slash commands do not port 1:1 to Codex. In Codex, prefer `$skill-name` invocation and use the helper scripts for direct operational tasks.

See [`CODEX_MIGRATION.md`](CODEX_MIGRATION.md) for the full Claude-to-Codex mapping, model policy, helper details, and command caveats. Reusable project rules translated from Claude live in [`AGENTS.md`](AGENTS.md).

> **V5.0 Phase 4** — Dashboard MVP. Standalone read-only HTTP server at `127.0.0.1:4003` (zero npm runtime deps, Node.js built-ins only — `http`, `fs`, `readline`, `url`) that reads `~/.claude/projects/*/memory/forgeflow-metrics.jsonl` across all projects, dedupes worktrees by stripping `(--worktrees-.+|-.worktrees-.+)$` from the sanitized directory name, aggregates verdict and auto-fix events per project and per ISO week, and serves a three-column single-page UI: project list + filter (left), verdict trend chart + stats strip + drift-status placeholder (center), live agent chat via `ws://${location.hostname}:4001` with exponential backoff reconnect (1s → 30s cap, ±500ms jitter, `wss:`/`ws:` derived from `location.protocol`) (right). **Accessibility:** WCAG 2.1 AA compliant — SVG trend chart has `role="img"` + `aria-labelledby="trend-title trend-desc"` + `focusable="false"` with `<title>`/`<desc>` preserved across every re-render (the `renderTrend()` SVG clear loop captures and re-appends both), hand-authored pattern fills (diagonal-hatch / vertical-lines / dots) differentiate APPROVE / REVISE / BLOCK without relying on color, `<section aria-labelledby="trend-heading">` + visually-hidden `<h2>` gives the metrics landmark an accessible name, selected project uses `aria-current="true"` (not orphaned `aria-selected`), `:focus-visible` outlines are always explicit 2px accent-blue rings, `--text-muted` lifted from 2.43:1 (#484f58) to 5.1:1 (#768390) across all informational labels, empty-state SVG text migrated off the stale hex, `prefers-reduced-motion` + `prefers-contrast: more` media blocks replicated, paired `visually-hidden` data table mirrors the SVG chart for screen readers. **Security:** host-header DNS-rebinding guard (accepts `127.0.0.1:4003` and `localhost:4003` only), symlink rejection via `fs.promises.realpath` + base-prefix check (`resolved.startsWith(metricsRoot + path.sep)`), 5 MB per-file size cap, `X-Content-Type-Options: nosniff` + `X-Frame-Options: DENY` + `Cache-Control: no-store` on all JSON responses, method gate returns 405 with `Allow: GET` header, no `cwd` leak in API responses, `Object.prototype.hasOwnProperty.call` guards prevent prototype pollution from parsed JSONL, `APPROVED` → `APPROVE` normalization at the telemetry emission boundary prevents silent data loss in the aggregator. **Schema contract:** `docs/forgeflow-metrics-telemetry-schema.md` formalizes the v1 JSONL shape for all 7 event types (`verdict`, `auto-fix-round`, `auto-fix-applied`, `command-invoked`, `command-completed`, `fleet-shard-complete`, `finding-overturned`) with additive-vs-breaking rules and an implicit-v1 reader rule; `hooks/forgeflow-telemetry.js` adds `schema_version: '1'` to every new record; consumers (dashboard `/api/metrics`, future CI tooling) skip records with unrecognized versions and increment a `parse_warnings` counter. **Tests:** 9 unit tests via `npx tsx --test` (routes, schema_version gating, implicit-v1 handling, unknown-version parse-warning, worktree dedup, method gate, team endpoint stub, and EADDRINUSE surfaces via `onError` callback), 7 Playwright E2E tests (title, API schema, accessibility landmarks, drift panel `aria-live`, SVG wrapper attributes + `#trend-title`/`#trend-desc` attached-after-render, project-scope-note visibility, error banner on 500). **Slash command:** `/dashboard` starts the server as a nohup daemon with a `/tmp/dashboard.pid` PID file and a 50×100ms readiness poll. Five rounds of Forgeflow review to APPROVE + CONFIRM: Round 1 scoped 4B-1 through 4B-4; Round 2 closed 5 nits (TOCTOU fix at `createReadStream(resolved)`, dead `opts.port`, empty tbody population, `applied_failed` snake_case, 4 E2E assertions); Round 3 REVISE caught 6 a11y gaps (SVG ARIA, `tr.innerHTML` XSS surface, broken `role="listbox"`, E2E wrong-element assertion, `:focus-visible` `outline:none`, doc drift); Round 4 REVISE caught the SVG title/desc render-loop regression + `aria-selected`-without-role + WCAG contrast fail + parse-warning `aria-label` silencing + `APPROVED` telemetry data loss + missing `h2` landmark + 100-line `scanMetrics` + port-conflict test gap + E2E survival check; Round 5 closed Lumen's mid-round `#484f58` empty-state catch. `scanMetrics` refactored into 5 single-responsibility helpers (`bumpVerdict`, `createZeroWeekBucket`, `applyRecord`, `aggregateProjectFile`, `resolveProjectFile`) now ~35 lines. Phase 4C deferred: functional drift panel (requires `/forgeflow-drift --cache` writer); team view (requires Phase 3 shared state to stabilize); false-positive leaderboard (reactivates at ≥3 `finding-overturned` events). — [Full changelog →](https://forgeflowai.github.io/Forgeflow/changelogs/v5.0-phase4.html)
>
> **V5.0 Phase 3** — Team shared state via `/forgeflow-sync`. Five subcommands synchronise the Forgeflow team knowledge base (`learnings.jsonl`, `patterns.md`, `codebase-map.md`, `review-history.md`) with a team-owned git remote so multiple developers share a single growing intelligence. `--init <remote-url>` validates the URL (rejecting credential-embedded and non-`https`/`git`/`git@` schemes), appends `.forgeflow/` to `.gitignore` as a blocking step zero, creates a private GitHub repo via API (10s timeout, single 5xx retry), writes `config.json` with all four schema fields (`remote_url`, `strategy`, `sync_branch`, `team_members`), and registers the `forgeflow-state` git remote. `--push` reads and re-validates `config.json` (SSRF-safe re-read), performs a fork push safety check, clones into a `chmod 700` temp dir, copies only the four shared files by name (never `git add .`), commits with an explicit `user.name=forgeflow-sync` identity, and writes a `.last-push` sentinel. `--pull` re-validates config, clones into a second temp dir, runs union dedup on `learnings.jsonl` (full-line dedup, no `git merge` ever on that file), and overwrites the other three files under remote-wins policy, writing a `.last-pull` sentinel on completion. `--status` reads both sentinels for honest timestamps, `git fetch`es to populate the local tracking ref, then reports one of four sync states (`[synced]` / `[remote has changes — run --pull]` / `[never synced — run --pull]` / `[remote unreachable]`). `--merge` scans `patterns.md`, `codebase-map.md`, `review-history.md` for conflict markers with line numbers and prints resolution instructions. `agent-notes/` is per-user and is never synced. `docs/forgeflow-sync-config-schema.md` documents the config schema, strategy enum, team_members structure, and migration path from per-user agent-notes naming. Eight rounds of Forgeflow review applied before merge; final hardening: `jq -r '.remote_url // empty'` null guard (Gotcha #3), tracking-ref fix in `--status`, and `n=$((n + 1))` safe increments throughout. — [Full changelog →](https://forgeflowai.github.io/Forgeflow/changelogs/v5.0-phase3.html)
>
> **V5.0 Phase 2** — CI + headless Forgeflow (Theme A). Runs the Forgeflow team on every PR without a human watching. `.github/workflows/forgeflow.yml` triggers on `pull_request` opened/synchronize/reopened; skip-check step runs first and short-circuits when the HEAD commit is `chore(auto-fix)*` to break the auto-fix workflow loop; checkout uses `ref: head.ref` so subsequent pushes hit a real branch instead of detached HEAD; concurrency group per PR with `cancel-in-progress`. `scripts/forgeflow-pr-review.sh` (~600 lines) validates per-repo `.github/forgeflow-budget.yml` config (enum/bool/number), computes a cap-aware cost pre-estimate, invokes `claude -p "/review --ci --pr N"` with `set +e`/`set -e` for race-free stderr capture, extracts the verdict via Python regex (DOTALL-robust), gates on `schema_version: 1`, and posts a PR comment with severity-tiered findings (stable IDs, file:line citations, reviewer attribution, class tags). Token-pattern redaction covers `sk-ant-*`, `Bearer *`, `ghp_*`, `gho_*`, `ghs_*` on every stderr surface that can reach PR comments. `<details>` tokens stripped from user-supplied finding text. Comment body truncated at 600 chars per finding with named-artifact breadcrumb. `/review --ci` flag: Step 0.4 CI_MODE detect; Step 0.5d.1 CI cap downgrades `full-mode` to `thin-mode` for cost savings but preserves `deep-mode` for auth/migration/crypto paths (security matters even in CI); Step 1 + 0.5a fork on `GITHUB_BASE_REF`/`--pr` to diff against `origin/<base>..HEAD` (CI working tree is clean); Step 7.5 emits a single `<forgeflow-verdict-json>{...}</forgeflow-verdict-json>` block per `docs/forgeflow-json-schema.md` v1 with authoritative findings parsing rules. `/review-auto --ci --from-verdict-json <path>` skips the initial review when a pre-computed verdict JSON is supplied (saves double-review cost); Step 6.2 pushes via `${GITHUB_HEAD_REF:-$(git branch --show-current)}`; Step 7.5 emits post-fix JSON with `auto_fix_applied`, `auto_fix_rounds`, `auto_fix_items_applied`, `auto_fix_commits`, `auto_fix_status`. Two modes: `review-only` (default, conservative — verdict comment, no writes) and `review-and-fix` (opt-in — auto-applies NIT + MUST-FIX-SAFE non-security fixes as `chore(auto-fix): round N` commits, follow-up PR comment links to primary via captured URL). Decision-gate metric locked: maintainer agrees with verdict ±1 tier on 5/5 PRs AND median cost ≤80% of `max_cost_per_pr_usd` AND zero silent failures — if any criterion fails, restart the window. Forgeflow-self-review: 3 rounds to APPROVE + CONFIRM. Round 1 found 15 genuine issues (including classifier file resolution that would have made every CI run skip-mode); round 2 caught a `STDERR_OUT` regression from an over-broad replace_all; round 3 clean. V5.1 backlog cleared into this release (decision-gate metric, schema v2 migration error JSON + PR comment, `/review-auto` stderr redaction, auto-fix comment URL linking). — [Full changelog →](https://forgeflowai.github.io/Forgeflow/changelogs/v5.0-phase2.html)
>
> **V5.0 Phase 1** — Self-improving Forgeflow + pre-filter/chunking. **Theme B (self-improving):** `/forgeflow-learnings` reads `.forgeflow/<project>/learnings.jsonl` across the filesystem, clusters findings by keyword affinity to canonical patterns, and auto-applies new project citations to existing `**Seen in:**` blocks in `forgeflow-patterns/recurring-blockers.md` at 2+ projects with 3+ occurrences; genuinely new clusters surface as `## Candidates for promotion` for human curation. `/forgeflow-drift` compares each agent file against its canonical `agents/_shared/*.md` reference with per-section `SYNCED` / `MODIFIED` / `DRIFTED` / `MISSING` status and actionable fix instructions (exit 1 on actionable drift so CI can gate). `/forgeflow-report` combines invocations, verdicts, auto-fix effectiveness, false-positive leaders, pattern promotions, and drift status into a single monthly executive surface with auto-derived priorities. False-positive tracking wired end to end: `arbiter-review.md` adds an `## Overturned Findings (telemetry)` section requiring exact-format tag lines when Arbiter dismisses a reviewer's finding; `hooks/forgeflow-telemetry.js` captures these as `finding-overturned` events; reviewers flagged at 3+ overturns per class surface in `/forgeflow-report` as prompt-refinement targets. **Theme C (scale):** `/review` Step 0.5 diff classifier routes to `skip-mode` (docs-only), `thin-mode` (test-only, lockfile bumps, 2 small files), `full-mode` (default), or `deep-mode` (migrations, auth, crypto, JWT, RBAC) &mdash; `--mode` overrides, CI mode delegates to `claude-haiku-4-5`. Step 3.6 chunks diffs over 30 files with monorepo detection (pnpm-workspace, lerna, turbo, nx, rush) or path-segment fallback, max 8 chunks, each chunk gets its own roster; Arbiter synthesizes per-chunk plus cross-chunk pattern detection. `/review --incremental` reviews each commit in a range separately with prior-commit findings carried forward, detecting regressions and cross-commit incoherence. `/fleet` merged-range review inherits the new classifier and chunking automatically. Phase 1 decision gate **PASS** &mdash; clusters matched on 515 real learning lines across 3 projects; classifier routes 10/10 sample diffs correctly. Phases 2 (CI + headless), 3 (team shared state), and 4 (dashboard MVP) still pending. — [Full changelog →](https://forgeflowai.github.io/Forgeflow/changelogs/v5.0-phase1.html)
>
> **V4.3** — Observability, integrity, cross-project memory, and plugin packaging. **Phase 1 (Observability):** `hooks/forgeflow-telemetry.js` records Forgeflow events (verdicts, auto-fix rounds, fleet shards, command invocations) to `~/.claude/projects/<project>/memory/forgeflow-metrics.jsonl`; `/forgeflow-metrics` summarizes by period and project with closed-loop effectiveness signals; `/forgeflow-health` audits installation integrity (agent files, commands, hooks, project-rules, hook wiring, version drift, gh auth) with `--fix` for safe auto-repair. **Phase 2 (Plugin Packaging):** `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json` enable one-command install via `claude plugin add` + `claude plugin install`; README adds Option A (plugin) alongside the existing manual Option B. **Phase 3 (Cross-Project Memory):** new `forgeflow-patterns/` directory with 4 files seeded from 515 labeled learning lines across campaign-management / llama.cpp / SubAgents projects — Tier A domain patterns (type safety, unimplemented features, null-safety), Tier B tooling patterns (agent mode-specificity, cold-start edges, output routing, prescriptive rules), verdict-trends by project type, and auto-fix classification decision flow. Atlas's `early`, `consult`, and `review` agents updated to read both per-project and global stores and cite matching patterns by name. `/update-forgeflow` extended to sync `forgeflow-patterns/*.md` and `hooks/forgeflow-telemetry.js`. **Phase 4 (Monorepo /fleet) deferred** pending Phase 1 telemetry signal — build only if `/fleet` sees 3+ real refactors per month. — [Full changelog →](https://forgeflowai.github.io/Forgeflow/changelogs/v4.3.html)
>
> **V4.2** — Lifecycle extensions driven by `/insights` friction analysis. **Five new commands:** `/handoff` (structured session-state snapshot; auto-invoked by `/review` on REVISE/BLOCK when context is constrained), `/review-auto` (closed-loop: `/review` → classify → auto-apply NIT + MUST-FIX-SAFE fixes via Forgeflow implement agents → re-review; iteration cap 2, hard safeguards on migrations/secrets/package.json/Warden-flagged items), `/fleet` (parallel worktree orchestration for phased refactors, max 10 shards, isolated per-worktree Postgres DB, sequential rebase-merge with typecheck/lint validation, auto-invokes `/review` on merged range), `/ui-iterate` (test-driven theme iteration with Playwright visual regression + axe-core fitness scoring), `/sync-upstream` (automates cp → commit → push for Forgeflow meta-work). **`/review` Step 0 pre-flight gate:** blocks Forgeflow dispatch on typecheck/lint failure, branch mismatch against linked PR, or working tree irregularities. **`/ship` additions:** Step 1b.1 branch assertion against linked PR, Step 1g commit hygiene validation (opt-in via `@~/.claude/project-rules/commit-hygiene.md`). **New `project-rules/` directory** ships opt-in per-project rules (`commit-hygiene.md`, `dev-environment.md`). **Hook skip behavior:** `forgeflow-gate.js` now suppresses advisory on Forgeflow meta-work, `~/.claude/` edits, and pure-docs diffs. **Gotchas sections** added to all five new commands per Anthropic's internal data showing measurable accuracy gains. Compass and Lumen review agents now check `.forgeflow/<project>/ui-iterations/` for recent fitness reports when theme changes are in the diff. — [Full changelog →](https://forgeflowai.github.io/Forgeflow/changelogs/v4.2.html)
>
> **V4.1.4** — `/debate` voice discipline + 3-round structure: three classes of fixes from Forgeflow transcript analysis. Class 1 (systemic): banned `"[Name] didn't just [verb]"` opener; rebuttal prompts now require agents engage a named peer first, then Arbiter — `"Arbiter called it X — but"` opener explicitly blocked. Class 2 (per-agent tics): voice profiles converted from descriptive prose to hard RULES with must-appear-once-per-turn constraints — Compass (`"Look"`, ≤6-word sentence, end on human/dollar, dash self-interrupt), Smith (25-word sentence cap, landing closer), Warden (`"The problem is"`, parenthetical sardonic aside, cold open), Atlas (`"Sure, X — but"`, `"Here's the thing"`, dash self-interrupt), Arbiter (first-name direct call-outs, every assessed agent named). Class 3 (structural): Round 3 added — each agent posts one falsifiable claim before final verdict; steelman required in opening prompts; judging criteria stated in Arbiter's opening announcement. — [Full changelog →](https://forgeflowai.github.io/Forgeflow/changelogs/v4.1.4.html)
>
> **V4.1.3** — `/debate` orchestrator overhaul: 2-round structure (opening statements → Arbiter interim verdict → rebuttals → final verdict); Arbiter names the Round 1 leader and calls out weak arguments explicitly, then is free to reverse on strong rebuttals (`VERDICT CHANGED:` / `VERDICT STANDS:`); `spawnSync` replaces `execSync` (no shell, no injection); parallel agent connections via `Promise.all`; 10-second connect timeout with hard reject; `ws.once` prevents duplicate ack handlers; debate config written with `0o600` permissions; `post()` delay reduced from 900ms to 100ms; `POST /clear` HTTP endpoint clears server history at debate start so a browser refresh always shows a clean room; dashboard `history-cleared` lifecycle event now handled in UI. — [Full changelog →](https://forgeflowai.github.io/Forgeflow/changelogs/v4.1.3.html)
>
> **V4.1.2** — Compass + Atlas review intelligence enhancements. Compass: Pre-Implementation Gate fires on cold reviews of auth/security/token/PII/compliance features; Requirements Coverage split into Defined Criteria (implementation failures) vs Undefined Criteria (spec gaps); CHALLENGE items require a `Grounded in:` citation to a specific file:line, plan item, or requirement — ungroundable items demote to a new Open Questions section; Atlas Cross-Session Notes now has an explicit sourcing path. Atlas: Coverage Check now requires per-agent file lists drawn from reviewer citations (checkbox alone is not evidence); Question Pre-Check gate blocks self-expansion of out-of-scope questions with an auditable dropped-questions log; all Questions for Arbiter carry BLOCK / REQUIRED / RECOMMENDED severity tiers; new Verdict Recommendation template; output descriptor section names aligned to actual headings. Both agents passed a full Forgeflow self-review run (REVISE verdict applied and cleared). — [Full changelog →](https://forgeflowai.github.io/Forgeflow/changelogs/v4.1.2.html)
>
> **V4.1.1** — Eight precision fixes to Arbiter from Forgeflow REVISE verdict on V4.1: Protocol 1 grounding check adapted to consult context (brief/symbol, not `file:line`); implement-mode Fail check 3 now routes to Path 3 deviation protocol (not a missing output section); canonical preamble made mode-neutral ("applies the subset relevant to the active mode"); `<!-- sourced from -->` comments replaced with mode-specific `<!-- adapted from -->` comments; "Commit atomically" rule removed from consult mode; fractional process step numbers (1.5, 1.75) renumbered to whole integers in both consult and review; docs/arbiter.md consult process updated with Scope Gate and Finding Validity Pre-Check steps, Lead Architect Intelligence bullet rewritten to distinguish mode scope; frontmatter description updated to include CONDITIONAL APPROVE verdict. — [Full changelog →](https://forgeflowai.github.io/Forgeflow/changelogs/v4.1.1.html)
>
> **V4.1** — Arbiter Architect Intelligence Layer (Finding Validity Pre-Check, Cross-Agent Convergence Check, Verdict Integrity Check) — [Full changelog →](https://forgeflowai.github.io/Forgeflow/changelogs/v4.1.html)
>
> **V4.0** — **Craft Intelligence** added to Smith (all four modes): 8-smell code smell taxonomy, naming precision rules, structure standards with hard limits, quality enforcement tiers (REJECT/WARN/NOTE), SOLID deep cuts with violation examples, design pattern use/don't-use guidance, and elegance heuristics. Database Authority extended with formal query pattern rules, index intelligence, migration safety patterns, and integrity patterns. Three-part finding reporting standard enforced. Seven precision fixes from Forgeflow audit: cyclomatic complexity formula corrected (bare `else` removed), idempotency pre-check added to Integrity Patterns, quality gates template structured as REJECT/WARN/NOTE, FK REJECT rule scoped (same-schema, non-polymorphic, audit tables exempt), finding reporting standard mode-qualified for consult, role block drive ordering corrected (Quality Absolutist first), thoughtfulness check expanded to full 8-smell taxonomy. — [Full changelog →](https://forgeflowai.github.io/Forgeflow/changelogs/v4.0.html)
>
> **V3.9** — **Design Voice** added to Lumen (all three modes): greenfield/adaptive mode detection, four aesthetic frameworks (hierarchy, tension, rhythm, gestalt), current design vocabulary with shelf-life signals (glassmorphism/claymorphism flagged as dated), craft depth across typography pairing, color theory (temperature contrast + tint stacking), motion choreography (easing + duration contracts), and spatial composition (8px grid + density ladder). Anti-pattern registry enforced in review. **Security Intelligence** added to Warden (all three modes): 12 Tier 1 OWASP Core vectors + 11 Tier 2 advanced vectors (SSRF, JWT algorithm confusion, CSRF, prototype pollution, race conditions, ReDoS, GraphQL attacks, and more), each with exploit path + code signature + hardened fix. Three-part finding standard enforced — no speculative security claims. Security review checklist restructured from 4 generic checks to Tier 1 (8 mandatory) + Tier 2 (10 conditional). Both layers backed by canonical reference files in `agents/_shared/`. — [Full changelog →](https://forgeflowai.github.io/Forgeflow/changelogs/v3.9.html)
>
> **V3.8** — `/debate-false-positive` command: structured 3-round multi-agent debate for false positive stress testing. Introduces the **pre-flight gate system** — mandatory verification checks injected directly into agent prompts before any finding in a category can be raised. 11-run calibration achieved 7/7 expected false positives correctly cleared with 0 phantom claims (up from 1/6 cleared and 5 phantoms at baseline). Core finding: structural intervention in the command prompt overrides behavioral priors more reliably than rules in agent definition files. Compass's phantom scoring definition narrowed to "objectively false claims about the code" — correct-but-out-of-scope concerns no longer count as phantoms. Full calibration methodology in [`docs/superpowers/methodology/`](docs/superpowers/methodology/). — [Full changelog →](https://forgeflowai.github.io/Forgeflow/changelogs/v3.8.html)
>
> **V3.7** — Agent quality pass derived from experimental multi-agent debate session. Compass: deduplication guard, pre-defined problem fast-track, "wrong direction > visible damage" framing. Smith review: cross-agent connections output section. Warden review: proportional threat calibration (scrutiny depth ≠ verdict threshold). Lumen review: chain-citing, invisible-bugs ownership, user-visible impact priority. Arbiter review: Compass added to Forgeflow roster, logical fallacy identification in synthesis, Compass CHALLENGE resolution required. Atlas: receipts-backed challenges, outcome specificity over generic coordination claims. Cross-cutting: stale copy-paste rules removed from non-implementation agents; parallel execution contradiction resolved across all three technical reviewers; Atlas memory carve-out fixed in consult and implement modes. — [Full changelog →](https://forgeflowai.github.io/Forgeflow/changelogs/v3.7.html)
>
> **V3.6** — Context monitor hook + GSD removal + audit memory persistence + agent chat. New `forgeflow-context-monitor.js` hook warns at 65% context used (WARNING) and 75% (CRITICAL) so you know when to `/compact` before auto-compaction data loss. GSD workflow integration removed — Forgeflow is now a standalone tool with no external dependencies. `/audit` now persists findings to `.forgeflow/learnings.jsonl` and `review-history.md` via Atlas after each audit. All 25 agents can now broadcast to a live chat dashboard via `csend` — use `/agent-chat:on` to start the server and open `http://127.0.0.1:4001` to watch agents in real time. — [Full changelog →](https://forgeflowai.github.io/Forgeflow/changelogs/v3.6.html)
>
> **V3.5** — `/create-agent` — interactively build a custom agent via 5-question Q&A. Pick a template (security, quality, domain expert, docs, performance, or blank), name it, specialise it, pick a tone and tools. Preview before write. Custom agents use a `custom-` prefix so `/update` never overwrites them, and `/quick` dispatches them directly: `/quick <task> custom-{name}`. — [Full changelog →](https://forgeflowai.github.io/Forgeflow/changelogs/v3.5.html)
>
> **V3.4** — `/update` rewritten to use curl. No local clone required: one `curl` installs the command, then `/update` pulls everything from GitHub directly. Version tracking via `~/.claude/forgeflow-version`; first run syncs all files, incremental runs sync only what changed. — [Full changelog →](https://forgeflowai.github.io/Forgeflow/changelogs/v3.4.html)
>
> **V3.3** — Context Pre-Loading Protocol. The orchestrator now reads all relevant files once before spawning any agent, injecting contents verbatim into each agent's prompt. Agents that receive pre-loaded context are barred from re-reading those files. In `/review`, 6 agents × N files collapses from 6N reads to 1 orchestrator read pass. All commands updated: `/discuss`, `/research`, `/plan`, `/consult`, `/implement`, `/review`, `/quick`. — [Full changelog →](https://forgeflowai.github.io/Forgeflow/changelogs/v3.3.html)

## The Forgeflow Agents

| Agent | Role | Specialties |
|-------|------|-------------|
| **Smith** | Database admin, backend architect, code quality implementer | Schema design, business logic, data integrity, code craft |
| **Warden** | Full-stack architect, security engineer | Auth, validation, hardening, efficiency, systems reuse |
| **Lumen** | UX/UI designer, frontend implementer, microservices connectivity specialist | Visual polish, accessibility, data pathway efficiency, service integration health |
| **Atlas** | Program manager, creative challenger, memory agent | Coordination, persistent learnings, cross-agent synthesis |
| **Arbiter** | Lead architect, Forgeflow director | Conflict resolution, implementation briefs, final technical verdict |
| **Compass** | Product manager, validation test designer, final reviewer | Requirements, plan adherence, E2E validation tests, pressure testing, accessibility compliance, UX intent |

## Lifecycle Commands

The Forgeflow team operates across 7 lifecycle commands plus ad-hoc shortcuts:

```
/discuss  →  /research  →  /plan  →  /consult  →  /implement  →  /review  →  /ship
```

| Command | Purpose | Agents Involved |
|---------|---------|-----------------|
| `/discuss` | Explore the problem space before technical work | Compass (leads), Atlas |
| `/research` | Investigate patterns, technology options, prior art | Compass (leads), Atlas |
| `/plan` | Create a structured implementation plan | Compass (leads), Atlas |
| `/consult` | Design the approach — architecture, interfaces, scope division | Smith, Warden, Lumen, Atlas, Arbiter |
| `/implement` | Parallel domain-specific coding guided by the Implementation Brief | Smith, Warden, Lumen, Compass, Atlas, Arbiter |
| `/review` | Post-implementation code review across all specialties (Step 0 pre-flight gates on typecheck/lint/branch; Step 0.5 diff classifier routes skip/thin/full/deep mode; Step 1.5 `--incremental` reviews per-commit with carry-forward; Step 3.6 chunks diffs over 30 files; auto-invokes `/handoff` on REVISE/BLOCK when context constrained) | All 6 agents |
| `/review-auto` | Closed-loop auto-fix: runs `/review`, classifies findings by tier + source reviewer, dispatches Forgeflow implement agents for NIT/MUST-FIX-SAFE fixes, re-reviews. Iteration cap 2. | Smith, Warden, Lumen, Atlas, Arbiter (review) + implement agents (fix) |
| `/fleet` | Parallel worktree orchestration — decompose phased spec into shards (max 10), isolated per-worktree Postgres DB, sequential rebase-merge with validation, auto-review on merged range | Smith, Warden, Lumen, Arbiter (implement mode, one per shard) |
| `/ship` | Generate presentation, create PR, monitor CI, auto-fix failures (Step 1b.1 branch assertion + Step 1g commit hygiene) | Compass, Atlas, Arbiter |
| `/ui-iterate` | Test-driven theme iteration with Playwright visual regression + axe-core fitness scoring — generates N variants, scores composite (contrast / palette / visual diff / a11y), surfaces top 3 per round | Lumen (implement) |
| `/handoff` | Structured session-state snapshot to `.claude/handoff.md` — branch, PR, last commit, review verdict, validation status, next action | — |
| `/audit` | Deep security, architecture, and systems audit (whole codebase or subsystem) | Smith (systems/DB), Warden (security/arch), Arbiter (synthesis) |
| `/quick` | Ad-hoc agent dispatch — run one or more agents on a short task, no lifecycle required | Domain heuristics (auto-routed) or any combination |
| `/create-agent` | Interactively build a custom agent via Q&A — 6 templates, preview before write | — |
| `/sync-upstream` | Automate Forgeflow meta-work sync from `~/.claude/` to the Forgeflow repo (cp → commit → push with auto account switching) | — |
| `/forgeflow-health` | Audit Forgeflow installation integrity — agent files, commands, hooks, project-rules, hook wiring, version drift, gh auth | — |
| `/forgeflow-metrics` | Summarize Forgeflow usage from telemetry logs — commands invoked, verdicts, auto-fix rounds, fleet shards, per week/month | — |
| `/forgeflow-learnings` | Cluster `learnings.jsonl` across projects; auto-promote citations to canonical patterns at 2+ projects with 3+ occurrences; surface new pattern candidates for manual curation | — |
| `/forgeflow-drift` | Compare agent files against their canonical `agents/_shared/*.md` references; report MISSING / DRIFTED / MODIFIED / SYNCED per section with fix instructions; exit 1 on actionable drift | — |
| `/forgeflow-report` | Monthly executive summary combining invocations, verdicts, auto-fix effectiveness, false-positive leaders, pattern promotions, and drift; auto-derived this-month priorities | — |
| `/review --ci` | Headless mode for CI pipelines. Suppresses markdown narrative, emits a single structured verdict JSON block per `docs/forgeflow-json-schema.md` v1. Classifier caps at thin-mode unless deep-mode triggers fire. | All 6 agents |
| `/review-auto --ci --from-verdict-json <path>` | CI-mode auto-fix that consumes a pre-computed verdict (from `/review --ci`) instead of running a second review. Pushes `chore(auto-fix)` commits back to the PR branch via `${GITHUB_HEAD_REF}`. | Forgeflow implement agents |
| `/update-forgeflow` | Pull the latest Forgeflow from GitHub and sync agents, commands, templates, project-rules, forgeflow-patterns, and hooks | — |
| `/forgeflow-sync --init <url>` | Initialise team shared state sync — validate URL, write `config.json`, create private GitHub repo, register `forgeflow-state` remote | — |
| `/forgeflow-sync --push` | Push shared Forgeflow files to the team remote (fork-safety check, clone-into-tempdir, named-file staging, `.last-push` sentinel) | — |
| `/forgeflow-sync --pull` | Pull from team remote — union dedup on `learnings.jsonl`, remote-wins overwrite for the rest, `.last-pull` sentinel | — |
| `/forgeflow-sync --status` | Show remote, last push/pull timestamps, and 4-state sync status | — |
| `/forgeflow-sync --merge` | Scan shared files for conflict markers with line numbers and print resolution instructions | — |
| `/debate` | Dynamic debate on any topic — agents auto-assigned positions, 3 rounds, Arbiter verdicts. Requires agent-chat server. | All 6 agents |
| `/debate-false-positive` | Code review false positive stress test — structured 3-round debate with answer key scoring | Smith, Warden, Lumen, Atlas, Arbiter, Compass |
| `/agent-chat:on` | Start the agent chat server (ports 4000 + 4001) as a background daemon | — |
| `/agent-chat:off` | Stop the agent chat server if running | — |
| `/dashboard` | Start the Forgeflow metrics dashboard server (port 4003) as a background daemon | — |

You can enter the lifecycle at any point. Smaller tasks can skip straight to `/consult` or `/review`. Use `/quick` for truly ad-hoc work that doesn't need the full lifecycle at all.

## Agent Deep Dives

Each agent has a full deep dive document in [`docs/`](docs/). Below is a summary of each agent's role, modes, and review dimensions.

---

### Smith — Database Admin, Backend Architect & Code Quality Implementer

> **Full deep dive:** [`docs/smith.md`](docs/smith.md)

Smith owns the data layer and holds the quality bar for every line of backend code. Enthusiastic about elegant solutions, uncompromising when standards slip.

**Three drives:** Database authority (schema, queries, migrations, indexes, data integrity), quality absolutist (clean, intentional, well-structured code), creative craftsman (solid fundamentals + elegance where it improves clarity).

#### Modes

| Mode | Output | What Smith Does |
|------|--------|-------------|
| Consult | Architecture Brief | Existing systems audit, database design, pattern selection, naming conventions, interface design, quality gates |
| Implement | Business logic, DB ops, models, utilities, types, config | Writes core backend code following SOLID principles; defines shared interfaces for other agents |
| Audit | Systems Audit | Database health, established patterns, dead code/duplication, dependency analysis |
| Review | Quality + Craft scores | Naming, structure, patterns, readability, DRY, modern idioms, elegance, thoughtfulness |

**Review scores:** `Quality: A/B/C/D/F` | `Craft: Creative / Solid / Lazy`

**Blocker rules:** Boyscout Rule fixes in touched files. Never suggests changes that break functionality for aesthetics.

---

### Warden — Full-Stack Architect, Security Engineer & Systems Integrator

> **Full deep dive:** [`docs/warden.md`](docs/warden.md)

Ruthlessly practical and allergic to waste. Sees the whole system end-to-end and finds every place it can break, leak, or slow down. Direct, no-nonsense, honest to the point of bluntness.

**Four principles:** Architecture owner (end-to-end system structure), reuse what exists (best code = code you didn't write), security non-negotiable (baked in, not bolted on), efficiency matters (batched ops, smart caching, no redundant work).

#### Modes

| Mode | Output | What Warden Does |
|------|--------|----------------|
| Consult | Architecture & Security Brief | Architecture proposal, security requirements, efficiency concerns, dependency check, integration points |
| Implement | Auth, validation, API hardening, full-stack glue | Middleware/guards, input sanitization, rate limiting, CORS, secrets management, connecting Smith's and Lumen's work |
| Audit | Security & Architecture Audit | Auth flows, injection surfaces, privilege escalation, system boundaries, coupling, duplicate code |
| Review | Security + Efficiency + Reuse scores | Input validation, auth checks, injection vectors, N+1 queries, memory leaks, redundant calls, unused dependencies |

**Review scores:** `Security: PASS/WARN/FAIL` | `Efficiency: PASS/WARN/FAIL` | `Reuse: PASS/WARN/FAIL`

**Security Intelligence (V3.9):** Operates from a 23-vector threat taxonomy — 12 Tier 1 OWASP Core vectors (mandatory every review) + 11 Tier 2 advanced vectors (SSRF, JWT algorithm confusion, CSRF, prototype pollution, ReDoS, GraphQL attacks, and more, applied conditionally by surface area). Three-part finding standard: Vector + Evidence + Fix — no speculative claims. Consult mode surfaces a Threat Surface section in the Architecture Brief. Canonical reference: [`agents/_shared/warden-security-intelligence.md`](agents/_shared/warden-security-intelligence.md).

**Blocker rules:** Confirmed security issues are always blockers. Threat calibration governs scrutiny depth — a public read-only endpoint gets proportional scrutiny, but any confirmed vulnerability blocks regardless of context. Points to EXACT file and function when flagging reuse. Quantifies efficiency impact (O(n^2) vs O(n)).

---

### Lumen — UX/UI Designer, Frontend Implementer & Microservices Connectivity Specialist

> **Full deep dive:** [`docs/lumen.md`](docs/lumen.md)

Laid-back and approachable, but razor sharp. Wears two hats: **Frontend** (activates for frontend files) and **Microservices Connectivity** (always on). Owns everything he touches — if it connects to something, he owns that connection too.

#### Core Principles

| Hat | Principle | What Lumen Checks |
|-----|-----------|-------------------|
| Frontend | **Visual Quality** | Spacing, alignment, typography, color, responsive, hover/focus states, transitions |
| Frontend | **UX Sensibility** | Loading/error/empty/success states, interaction flow, destructive action confirmation |
| Frontend | **Accessibility** | WCAG AA contrast, semantic HTML, ARIA, keyboard nav, focus management, screen readers |
| Connectivity | **Data Pathway Efficiency** | Call chain length, redundant fetches, N+1 across boundaries, payload bloat |
| Connectivity | **Resilience** | Timeouts on every outbound call, idempotent retries, circuit breakers, graceful degradation |
| Connectivity | **Ownership Signals** | Dead connections, undocumented pathways, shared state leaks |

#### Modes

| Mode | Output | What Lumen Does |
|------|--------|-----------------|
| Consult | Design & Connectivity Brief | Component design, interaction flow, visual approach, data flow mapping, call chain audit, failure mode planning |
| Implement | Frontend code + connectivity code | HTML/CSS/JS, components, accessibility, service clients, caching layers, circuit breakers, integration tests |
| Review | 5-dimension ratings | Visual, UX, Performance, Accessibility, Connectivity per file/component/service |

**Design Voice (V3.9):** Greenfield/adaptive mode detection, four aesthetic frameworks (hierarchy, tension, rhythm, gestalt), design vocabulary with shelf-life signals (glassmorphism/claymorphism flagged as dated), craft depth across typography pairing, color theory, motion choreography, and spatial composition. Anti-pattern registry (MUI defaults, hover-only affordances, rainbow palettes, icon-only actions) enforced in review. Canonical reference: [`agents/_shared/lumen-design-principles.md`](agents/_shared/lumen-design-principles.md).

**Review scores:** `Visual: Clean/Decent/Rough` | `UX: Smooth/Okay/Clunky` | `Performance: Fast/Fine/Sluggish` | `Accessibility: Solid/Gaps/Needs Work` | `Connectivity: Clean/Redundant/Fragile` | `Design vocab: Current/Dated/Flagged` | `Anti-patterns: None/Present/Blocking`

**Blocker rules:** Accessibility failures that prevent operation. Redundant service calls that double latency. Missing timeouts on service-to-service calls — every time. MUI defaults without customization always flagged.

---

### Atlas — Program Manager, Creative Challenger & Persistent Memory Agent

> **Full deep dive:** [`docs/atlas.md`](docs/atlas.md)

Wide-eyed newcomer with fresh perspective, relentless curiosity, and sharp PM instincts. The only agent with persistent memory — learnings, patterns, and codebase knowledge survive across sessions in `.forgeflow/<project-name>/`.

**Three capabilities:** Creative challenger (questions everything, bounces ideas across agents, champions creative solutions), program manager (ensures completeness, removes blockers, synthesizes across agents), persistent memory agent (institutional knowledge that compounds over time).

#### Modes

| Mode | Output | What Atlas Does |
|------|--------|---------------|
| Consult | Consultation Notes | Loads context, surfaces history, challenges approach, identifies scope boundaries, flags coordination risks |
| Implement | Coordination (no application code) | Ensures lane discipline, manages shared interfaces, resolves file conflicts, tracks progress, persists learnings |
| Review | Creative Challenge + PM Status + Memory Update | Probing questions, reviewer coverage check, cross-agent connections, memory persistence |
| Present | Developer-facing JSON | Files changed, test results, architecture notes, review verdict, risks mitigated |

**Memory files:** `codebase-map.md`, `learnings.jsonl`, `patterns.md`, `review-history.md`, `agent-notes/<agent>.md`

**Compounding value:** By the third review cycle, the Forgeflow team knows the project's conventions, recurring issues, and established patterns.

---

### Arbiter — Lead Architect & Forgeflow Director

> **Full deep dive:** [`docs/arbiter.md`](docs/arbiter.md)

Calm, authoritative, fair. Consolidates four specialist opinions into one clear direction. Produces the Implementation Brief (binding contract for parallel work) and the final consolidated review verdict.

#### Modes

| Mode | Output | What Arbiter Does |
|------|--------|----------------|
| Consult | **Implementation Brief** | Resolves conflicts, validates scope, defines shared interfaces, sets wave order, produces the binding brief |
| Implement | Oversight report | Spot-checks agent output, resolves integration conflicts, approves deviations, writes integration glue, validates Compass's tests |
| Review | **Consolidated Verdict** | Reads all reviews, pressure-tests findings, synthesizes into tiered output |

**Implementation Brief sections:** Architecture decision, Wave 1/2 scope assignments, shared interfaces with exact type signatures, security requirements, quality gates, UX/connectivity requirements, conflict resolutions, coordination notes.

**Review tiers:** Blockers > Required Changes > Recommended Improvements > Boyscout Fixes > Highlights

**Verdict:** APPROVE / CONDITIONAL APPROVE / REVISE / BLOCK

**Hard rules:** Never overrides Warden's security failures or Lumen's accessibility blockers without personal verification. If Compass issues a CHALLENGE against an APPROVE verdict, addresses it in Reviewer Disagreements — does not let it pass to the user unaddressed. Identifies reasoning fallacies in agent findings (importance-by-catastrophe, conflating criticality with contribution). Prioritizes ruthlessly. Resolves contradictions explicitly. If all agents approve clean, doesn't invent problems.

---

### Compass — Product Manager, Validation Test Designer & Final Reviewer

> **Full deep dive:** [`docs/compass.md`](docs/compass.md)

Calm authority with deep experience in requirements engineering and strategic planning. Leads the early phases (Discuss, Research, Plan), designs validation tests during Implementation, and performs the final review after Arbiter's verdict. Strong creative streak and unwavering accessibility champion.

#### Modes (6 — most of any agent)

| Mode | Output | What Compass Does |
|------|--------|----------------|
| Discuss (leads) | Discussion Summary | Problem framing, requirements (must/should/nice-to-have), success criteria, accessibility requirements, UX vision, open questions |
| Research (leads) | Research Findings | Codebase patterns, technology evaluation with a11y implications, prior art, risk identification, clear recommendation |
| Plan (leads) | Implementation Plan | Phased deliverables with a11y woven in, scope boundaries, UX validation points, risk mitigations, success validation |
| Implement | Validation Test Plan | Playwright E2E tests (preferred), framework tests, manual checklists, pressure tests — all mapped to success criteria |
| Review (final) | Plan Adherence Review | Plan adherence, research alignment, requirements coverage, a11y compliance, UX intent, E2E test results, pressure test results |
| Present | Stakeholder-facing JSON | Headline, summary, capabilities (new/enhanced/fixed), before/after, impact, accessibility notes |

**Review verdict:** CONFIRM / CHALLENGE

- **CONFIRM** — Implementation aligns. Arbiter's verdict stands.
- **CHALLENGE** — Specific items need attention. Explains why each matters.

**Blocker rules:** Accessibility failures are blockers (same weight as Lumen's). Test failures carry the same weight as plan adherence issues. If plan was skipped, notes the gap explicitly.

---

## How It Works

### Review (`/review`)
Spawns Smith, Warden, Lumen, Atlas in parallel. The orchestrator pre-loads all changed file contents before spawning any agent — each agent receives an `<injected-context>` block and is barred from re-reading those files. Lumen's frontend hat activates for frontend files; his connectivity hat is always on. Arbiter then synthesizes all findings into a consolidated verdict (APPROVE / REVISE / BLOCK). Compass performs the final review checking plan adherence, accessibility, and UX intent (CONFIRM / CHALLENGE).

### Consultation (`/consult`)
Each agent analyzes the task from their domain — Smith proposes architecture, Warden audits security and existing systems, Lumen designs UI components and maps data connectivity, Atlas loads prior learnings and challenges assumptions. Arbiter resolves conflicts and produces an **Implementation Brief** with wave structure, scope assignments, and shared interfaces.

### Implementation (`/implement`)
Agents execute the brief in waves. Wave 1 builds foundations (data models, auth, shared types). Wave 2 runs in parallel once interfaces are defined. Atlas coordinates, tracks progress, and resolves file conflicts. Arbiter spot-checks integration.

### Ship (`/ship`)
Enforces a review gate (requires APPROVE + CONFIRM). Compass generates stakeholder-facing content (headline, summary, capabilities, before/after). Atlas generates developer-facing content (files changed, test results, architecture notes, review verdict). The orchestrator assembles a self-contained HTML presentation, creates a PR, monitors CI inline (~5 min), and falls back to an async watcher script for slow pipelines. Failed CI checks are auto-routed to Smith and/or Warden for resolution (max 3 attempts).

## Workflow Guide

### The Full Lifecycle

The Forgeflow team is designed around a linear lifecycle. Each phase feeds the next. The full flow looks like this:

```
/discuss  →  /research  →  /plan  →  /consult  →  /implement  →  /review  →  /ship
   │             │            │           │             │             │          │
   │             │            │           │             │             │          └─ PR + CI + presentation
   │             │            │           │             │             └─ 6-agent code review
   │             │            │           │             └─ Parallel coding by Smith/Warden/Lumen
   │             │            │           └─ Architecture brief with scope assignments
   │             │            └─ Structured implementation plan
   │             └─ Technology research + prior art
   └─ Problem exploration + requirements
```

**Each phase produces artifacts that the next phase consumes.** Compass's plan feeds into Arbiter's implementation brief. The brief assigns scope to each agent during implementation. The Forgeflow checks the implementation against the plan. `/ship` gates on review approval.

### When to Use the Full Flow

**Use all 7 phases when:**
- Building a significant feature (multiple files, multiple agents' domains)
- Working in an unfamiliar codebase where research matters
- The feature has UX, security, and data layer implications
- Stakeholders need a presentation of what shipped

### When to Skip Phases

Not every task needs all 7 phases. Here's how to shortcut efficiently:

| Task Size | Start At | Skip |
|-----------|----------|------|
| **Ad-hoc task** (quick fix, focused question, one-shot review) | `/quick` | Everything — no lifecycle needed |
| **Bug fix** (1-3 files) | Write the fix yourself, then `/review` | Everything before review |
| **Small feature** (3-10 files, single domain) | `/consult` → `/implement` → `/review` | discuss, research, plan |
| **Medium feature** (10+ files, multiple domains) | `/plan` → `/consult` → `/implement` → `/review` | discuss, research |
| **Large feature** (new system, multiple services) | Full flow starting at `/discuss` | Nothing |
| **Quick review of existing changes** | `/review` directly | Everything else |
| **Ship after manual implementation** | `/review` → `/ship` | Everything before review |

**Rule of thumb:** If you already know what to build and how, skip to `/consult`. If you know the architecture but need the Forgeflow team to write it, skip to `/implement` with a brief. If you just want a quality check, go straight to `/review`.

### Phase-by-Phase: What Happens and What You Do

#### `/discuss` — Problem Exploration
**You provide:** A description of what you want to build or the problem to solve.
**Compass does:** Asks structured questions one at a time to understand requirements, constraints, success criteria, and edge cases. Pushes back on vague requirements.
**Atlas does:** Loads prior learnings, challenges assumptions, surfaces relevant history.
**You get:** A clear problem definition and requirements summary saved to `.forgeflow/<project>/current-discussion.md`.

**Tip:** Don't skip this for complex features. 10 minutes of discussion saves hours of rework when the Forgeflow team builds the wrong thing.

#### `/research` — Technology & Pattern Research
**You provide:** Nothing extra — it reads the discussion output.
**Compass does:** Investigates technology options, existing patterns in the codebase, prior art, and alternative approaches. Produces a research summary with recommendations.
**You get:** Research findings saved to `.forgeflow/<project>/current-research.md`.

**Tip:** Most useful when you're integrating with unfamiliar APIs, choosing between libraries, or building something the codebase doesn't have a pattern for yet. Skip for routine features.

#### `/plan` — Implementation Planning
**You provide:** Nothing extra — it reads discussion and research outputs.
**Compass does:** Creates a structured implementation plan with phases, file assignments, success criteria, accessibility requirements, and risk assessment.
**You get:** A plan saved to `.forgeflow/<project>/current-plan.md`.

**Tip:** The plan is what Compass checks against during her final review. If you skip `/plan`, Compass does a lighter-touch review focused only on accessibility and UX intent.

#### `/consult` — Architecture & Scope Division
**You provide:** A task description, or nothing if a plan already exists (it loads automatically).
**The Forgeflow team does:**
- **Smith** proposes architecture, data models, naming, interfaces
- **Warden** audits existing systems, defines security requirements, plans DB changes
- **Lumen** designs UI components + maps microservice data flows
- **Atlas** loads prior learnings, challenges assumptions, proposes scope division
- **Arbiter** resolves conflicts and produces the **Implementation Brief**

**You get:** An Implementation Brief with wave structure, per-agent scope, shared interfaces, and quality gates. Saved to `.forgeflow/<project>/current-brief.md`.

**Tip:** Read the brief before running `/implement`. If the scope division doesn't look right, modify it. The brief is the contract the agents follow.

#### `/implement` — Parallel Agent Coding
**You provide:** Nothing extra — it loads the brief automatically.
**The Forgeflow team does:**
- **Wave 1** runs first (foundations — data models, auth, shared types). Typically Smith and Warden.
- **Wave 2** runs in parallel after Wave 1 interfaces are verified. All assigned agents.
- **Compass** designs validation tests in parallel with Wave 2 — Playwright E2E tests if installed, automated + manual test checklists otherwise. Tests map to every success criterion from the plan.
- **Atlas** coordinates, manages interfaces between agents, resolves file conflicts.
- **Arbiter** spot-checks integration after all waves complete, including verifying Compass's tests reference real implementation.

**You get:** Working code committed atomically by each agent, validation tests ready for `/review`, plus an integration report.

**Tip:** The brief guarantees no two agents touch the same file in the same wave. Compass writes only to the test directory — no conflict with implementation agents.

#### `/review` — 6-Agent Code Review + E2E Feature Validation
**You provide:** File paths, a git ref, or nothing (reviews all uncommitted changes).
**The Forgeflow team does:**
- **Smith** reviews for code quality, design, patterns
- **Warden** reviews for security, efficiency, reuse
- **Lumen** reviews for frontend quality (if applicable) AND microservice connectivity (always)
- **Atlas** loads context, challenges assumptions, cross-links findings, persists learnings
- **Arbiter** synthesizes all findings → **APPROVE / REVISE / BLOCK**
- **Compass** runs E2E validation tests (Playwright/automated + manual checklists), executes pressure test scenarios, checks plan adherence, accessibility, UX intent → **CONFIRM / CHALLENGE**. Test failures carry the same weight as plan adherence issues.

**You get:** A consolidated verdict with required changes (if any), plus E2E test results with pass/fail evidence per feature. Fix and re-run `/review` until APPROVE + CONFIRM.

**Tip:** The hook auto-suggests `/review` at natural wrap-up points (commit, test run, 5+ files edited). You don't have to remember to run it.

#### `/ship` — PR + Presentation + CI
**You provide:** An optional PR title/description, or nothing (Compass infers from commits).
**The Forgeflow team does:**
- **Gates** on APPROVE + CONFIRM from the latest review
- **Compass** generates stakeholder-facing JSON (headline, summary, capabilities, before/after)
- **Atlas** generates developer-facing JSON (files, tests, architecture, verdict)
- **Orchestrator** assembles a self-contained HTML presentation
- **Creates PR** with meaningful body derived from agent content
- **Monitors CI** inline (~5 min), falls back to async watcher for slow pipelines
- **Auto-fixes** CI failures by routing to Smith/Warden (max 3 attempts)

**You get:** A merged-ready PR, an HTML presentation in `.forgeflow/<project>/presentations/`, and green CI (or a clear escalation if auto-fix fails).

#### `/quick` — Ad-hoc Agent Dispatch
**You provide:** A task description, and optionally which agents to involve and their modes.
**The Forgeflow team does:**
- **No agents specified** — inline domain heuristics pick the single best-fit agent and mode, fires immediately. Maximum two agents if the task genuinely spans two separable domains.
- **Agents without modes** — each named agent runs a lightweight pre-flight (MODE/RELEVANCE/REASON). Only high-relevance agents proceed. You confirm before work begins.
- **Agents with explicit modes** (e.g. `fc:implement,warden:review`) — fires immediately, no pre-flight, no confirmation.
- **`+arbiter` flag** — after primary agents complete, Arbiter synthesizes all outputs into a consolidated verdict.

**Syntax:**
```
/quick <task description>                             # auto-routed via domain heuristics
/quick <task description> fc,warden                    # self-select pre-flight
/quick <task description> fc:implement,warden:review   # explicit — fires immediately
/quick <task description> lumen,fc +arbiter            # self-select + Arbiter synthesis
/quick <task description> custom-{name}               # dispatch a custom agent directly
/quick <task description> custom-{name},warden:review  # custom agent + Forgeflow agent (Forgeflow must have :mode)
```

**Agent aliases:** `fc` (Smith), `warden`, `lumen` (Lumen), `cory` (Atlas), `arbiter`, `compass`

**You get:** Agent output(s) in `=== AGENT (mode) ===` format, plus Arbiter's synthesis if `+arbiter` was specified. No `.forgeflow/` artifacts written.

**Tip:** `/quick` is the zero-ceremony option. No plan, no brief, no persistent memory updates. Use it for focused questions, quick fixes, or spot checks where the full lifecycle would be overkill.

### Custom Agents

Create your own agents tailored to your project's domain using `/create-agent`. Custom agents live at `~/.claude/agents/custom-{name}.md` and are dispatched via `/quick` like any Forgeflow agent.

```
/create-agent
```

The command walks you through 5 questions:
1. **Template** — security reviewer, code quality, domain expert, documentation, performance, or blank
2. **Name** — becomes `custom-{name}.md`; validated lowercase/hyphens only
3. **Specialization** — what the agent focuses on (e.g. "PCI DSS compliance", "React Query patterns")
4. **Tone** — direct/blunt, collaborative, formal, or neutral
5. **Tools** — defaults from template; any of Read, Write, Edit, Bash, Grep, Glob

Shows a full preview before writing anything. `/update` never overwrites `custom-` agents.

**Example:**
```
/quick review the payments module for PCI compliance issues custom-payments-expert
```

### Efficiency Tips

1. **Don't re-run phases unnecessarily.** Each phase saves its output. If you already ran `/discuss` and `/research`, jumping to `/plan` will pick them up automatically.

2. **The review hook is your friend.** It fires when you're about to commit or run tests. Let it remind you instead of tracking review timing yourself.

3. **Fix and re-review, don't argue.** If the Forgeflow team says REVISE, fix the items and re-run `/review`. Each round gets faster as prior findings are resolved. Most features pass in 1-2 rounds.

4. **Use `/review` with file paths for focused reviews.** `/review src/auth.ts src/middleware.ts` is faster than reviewing everything when you only changed two files.

5. **Atlas's memory compounds.** The more you use the Forgeflow team on a project, the smarter it gets. Atlas persists learnings, patterns, and anti-patterns across sessions. By the third review cycle, the Forgeflow team knows your project's conventions.

6. **Lumen always participates now.** Even pure backend changes get a connectivity review. If your services talk to each other, Lumen is checking those pathways.

7. **`/ship` is a commitment.** It pushes code, creates PRs, and auto-fixes CI. Only invoke it when you're ready to go to remote. Everything before `/ship` is local-only.

8. **The orchestrator reads, agents execute.** As of V3.3, every command pre-loads file contents before spawning agents. Agents work from injected context, not independent file reads. This cuts redundant token spend — especially on `/review` where all 6 agents previously read the same files independently.

---

## Persistent Memory

Atlas maintains Forgeflow memory in `.forgeflow/<project-name>/`:

| File | Purpose |
|------|---------|
| `codebase-map.md` | Living architecture map updated each review cycle |
| `learnings.jsonl` | Append-only log of findings (one JSON object per line) |
| `patterns.md` | Project patterns to follow and anti-patterns to flag |
| `review-history.md` | Summary of past reviews with verdicts and findings |
| `agent-notes/<agent>.md` | Per-agent knowledge files for cross-session context |

This directory is gitignored — it's local session state, not portable.

## Forgeflow Gate (Hook)

Two PostToolUse hooks ship with the Forgeflow team:

**`hooks/forgeflow-gate.js`** monitors coding sessions and suggests running the Forgeflow at natural wrap-up points:
- Fires on git commit/add, test runner invocation, or 5+ files edited followed by a build command
- 10-minute debounce between advisories
- Detects `pr-failure.md`, `pr-success.md`, and `pr-timeout.md` from the async watcher and surfaces them in the next session

**`hooks/forgeflow-context-monitor.js`** warns when the context window approaches limits:
- **WARNING** at 65% used (35% remaining) — suggests `/compact Focus on [active feature]`
- **CRITICAL** at 75% used (25% remaining) — urgent prompt to compact before auto-compaction causes data loss
- Debounces per 5 tool uses per threshold so it doesn't nag
- Requires `forgeflow-statusline.js` to be configured as your `statusLine` (it writes the bridge file that the monitor reads)

**`hooks/forgeflow-statusline.js`** is the companion statusline that feeds context data to the monitor:
- Displays model, working directory, and a context usage bar in the status line
- Writes `/tmp/claude-ctx-{session_id}.json` on every render so the context monitor can read it
- Configure as your `statusLine` in `~/.claude/settings.json` — see Installation for details

## Installation

### Prerequisites
- [Claude Code CLI](https://claude.com/claude-code) with Agent tool support
- Node.js 18+
- `gh` CLI (for `/ship` PR creation and CI monitoring)
- `jq` (for the async watcher script)

### Option A — Plugin install (V4.2+, recommended)

```bash
claude plugin add ForgeflowAI github:ForgeflowAI/Forgeflow
claude plugin install Forgeflow@ForgeflowAI
```

This installs all agents, commands, hooks, templates, project-rules, and forgeflow-patterns automatically. After install, wire the four hooks into `~/.claude/settings.json` (see step 4 below) and run `/forgeflow-health` to verify.

### Option B — Manual setup (pre-V4.2 method)

1. Copy agent definitions to your Claude config:
   ```bash
   cp agents/*.md ~/.claude/agents/
   ```

2. Copy commands:
   ```bash
   cp commands/*.md ~/.claude/commands/
   ```

3. Copy the HTML template:
   ```bash
   mkdir -p ~/.claude/templates
   cp templates/ship-presentation.html ~/.claude/templates/
   ```

4. Install the hooks — add both to your `.claude/settings.json` under `hooks.PostToolUse`:
   ```json
   {
     "hooks": {
       "PostToolUse": [
         {
           "hooks": [
             {
               "type": "command",
               "command": "node /path/to/hooks/forgeflow-context-monitor.js"
             }
           ]
         },
         {
           "hooks": [
             {
               "type": "command",
               "command": "node /path/to/hooks/forgeflow-gate.js"
             }
           ]
         }
       ]
     }
   }
   ```

5. Ensure `.forgeflow/` is in your project's `.gitignore`.

### Staying Up to Date

Install the `/update-forgeflow` command once:

```bash
curl -sf "https://raw.githubusercontent.com/ForgeflowAI/Forgeflow/main/commands/update-forgeflow.md" \
  -o ~/.claude/commands/update-forgeflow.md
```

Then run `/update-forgeflow` in Claude Code any time to sync the latest agents, commands, templates, and hooks from GitHub — no local clone required.

## Repository Structure

```
agents/                            # Mode-specific agent files (25 files)
  _shared/
    rules.md                       #   Shared rules reference (inlined in each file)
  compass-discuss.md                 #   Compass — discuss mode
  compass-research.md                #   Compass — research mode
  compass-plan.md                    #   Compass — plan mode
  compass-implement.md               #   Compass — implement mode (validation test design)
  compass-review.md                  #   Compass — final review mode
  compass-present.md                 #   Compass — stakeholder presentation mode
  smith-consult.md      #   Smith — consult mode
  smith-implement.md    #   Smith — implement mode
  smith-audit.md        #   Smith — audit mode
  smith-review.md       #   Smith — review mode
  warden-consult.md                 #   Warden — consult mode
  warden-implement.md               #   Warden — implement mode
  warden-audit.md                   #   Warden — audit mode
  warden-review.md                  #   Warden — review mode
  arbiter-consult.md                 #   Arbiter — consult mode
  arbiter-implement.md               #   Arbiter — implement mode
  arbiter-review.md                  #   Arbiter — review mode
  atlas-early.md                 #   Atlas — discuss/research/plan (consolidated)
  atlas-consult.md               #   Atlas — consult mode
  atlas-implement.md             #   Atlas — implement mode
  atlas-review.md                #   Atlas — review mode
  atlas-present.md               #   Atlas — developer presentation mode
  lumen-consult.md       #   Lumen — consult mode
  lumen-implement.md     #   Lumen — implement mode
  lumen-review.md        #   Lumen — review mode
commands/                          # Lifecycle commands + extensions + utilities
  discuss.md                       #   Problem exploration
  research.md                      #   Pattern and technology research
  plan.md                          #   Implementation planning
  consult.md                       #   Pre-implementation consultation
  implement.md                     #   Parallel agent implementation
  review.md                        #   Full Forgeflow code review (Step 0 pre-flight gate)
  review-auto.md                   #   Closed-loop auto-fix via Forgeflow implement agents (V4.2)
  ship.md                          #   Presentation, PR, CI monitoring (branch + hygiene gates)
  fleet.md                         #   Parallel worktree orchestration (V4.2)
  ui-iterate.md                    #   Test-driven theme iteration with fitness scoring (V4.2)
  handoff.md                       #   Structured session-state snapshot (V4.2)
  audit.md                         #   Deep security, architecture, and systems audit
  quick.md                         #   Ad-hoc agent dispatch (supports custom agents)
  create-agent.md                  #   Interactive custom agent builder
  sync-upstream.md                 #   Automate Forgeflow meta-work sync to upstream (V4.2)
  update-forgeflow.md            #   Sync latest Forgeflow from GitHub via curl
  forgeflow-sync.md                    #   Team shared state sync (--init/--push/--pull/--status/--merge) (V5.0 Phase 3)
  agent-chat/
    on.md                          #   Start the agent chat server as a background daemon
    off.md                         #   Stop the agent chat server
  debate.md                        #   Dynamic topic debate (any topic, auto-assigned positions)
  debate-false-positive.md         #   Code review false positive stress test
project-rules/                     # Opt-in per-project rules (V4.2)
  commit-hygiene.md                #   72-char body, prettier before stage, stale imports
  dev-environment.md               #   Worktree + port + env var discipline
forgeflow-patterns/                    # Cross-project pattern library (V4.2)
  recurring-blockers.md            #   Blocker classes with plan/review-time checks (Tier A)
  tooling-patterns.md              #   Agent-orchestration-specific patterns (Tier B)
  verdict-trends.md                #   Verdict distribution by project type
  auto-fix-patterns.md             #   /review-auto classification rules
.claude-plugin/                    # Plugin manifest (V4.2)
  plugin.json                      #   Plugin metadata + install destinations
  marketplace.json                 #   Marketplace entry for plugin discovery
hooks/
  forgeflow-gate.js             # PostToolUse hook — review advisory at wrap-up points (V4.2 skip logic)
  forgeflow-context-monitor.js  # PostToolUse hook — context window WARNING/CRITICAL alerts
  forgeflow-statusline.js       # statusLine hook — context bar + bridge file for monitor
  forgeflow-telemetry.js               # PostToolUse hook — Forgeflow usage telemetry → jsonl per project (V4.2)
templates/
  ship-presentation.html           # Self-contained HTML reference template
services/
  agent-chat/                      # Agent chat dashboard server
    debate.js                      #   General-purpose debate orchestrator (node debate.js "<topic>")
  chat-bridge/                     # Bridge between agents and chat server
  dashboard/                       # Forgeflow metrics dashboard server (port 4003)
docs/
  compass.md                         # Agent deep dive — Compass
  smith.md              # Agent deep dive — Smith
  warden.md                         # Agent deep dive — Warden
  arbiter.md                         # Agent deep dive — Arbiter
  atlas.md                       # Agent deep dive — Atlas
  lumen.md               # Agent deep dive — Lumen
  forgeflow-sync-config-schema.md      # /forgeflow-sync config.json schema, strategy enum, team_members, migration path (V5.0 Phase 3)
  superpowers/specs/               # Design specifications
```

## License

Private — internal use.
