# Workflow Commands

Forgeflow can be used as a full lifecycle or as targeted commands. For scenario-based routing, start with [User Paths](User-Paths). This command reference lists what each command does after you know the path.

## Lifecycle

```text
/discuss -> /research -> /plan -> /consult -> /implement -> /review -> /ship
```

## Common Commands

| Command | Purpose |
|---|---|
| `/discuss` | Frame the problem, user needs, constraints, and open questions. |
| `/research` | Evaluate options, prior art, codebase patterns, and risks. |
| `/plan` | Produce a phased implementation plan with validation criteria. |
| `/consult` | Produce an implementation brief across architecture, security, UX, and coordination. |
| `/implement` | Execute the current brief with coordinated agents and maintain `.forgeflow/<project>/implementation-notes.md`. |
| `/review` | Review changed files with explainable routing and multi-agent synthesis, then record the final verdict in `.forgeflow/<project>/review-history.md` for `/ship`. |
| `/review-auto` | Apply conservative safe fixes, refresh/check project learnings, then re-review and record the post-fix approval state. |
| `/audit` | Run a deeper systems/security/craft audit. |
| `/agent-chat:on` | Start the agent-chat WebSocket and dashboard server on local ports 4000 and 4001 for live workflow visibility. |
| `/agent-chat:off` | Stop agent-chat and preserve the auto-saved chat log when messages were captured. |
| `/create-agent` | Interactively create a local custom Claude Code agent under `~/.claude/agents/custom-*.md`; managed updates do not overwrite these files. |
| `/dashboard` | Start the optional local metrics dashboard on port 4003, including the Project Readiness panel backed by `GET /api/readiness`. |
| `/debate` | Run a structured false-positive stress test against a code sample and sealed answer key. |
| `/fleet` | Decompose a phased spec into isolated worktree shards, run parallel Forgeflow implementers, then merge sequentially with validation. |
| `/handoff` | Write a rolling `.claude/handoff.md` so a future session can resume with current branch, PR, validation, pending work, and next action context. |
| `/quick` | Dispatch one or more Forgeflow agents directly for a short task without running the full lifecycle. |
| `/forgeflow-architecture` | Render advisory architecture docs from local topology, project intelligence, operating model, and learning artifacts; add `--write` to save local `.forgeflow/<project>/context/architecture.*` files. |
| `/forgeflow-adoption` | Print a concise adoption pack with fit guidance, first-trial steps, proof boundaries, and repeat/expand/fix/defer rubric. |
| `/forgeflow-invocation-hints` | Render advisory runtime entrypoint and invocation hints from package metadata, config files, topology, architecture evidence, and static conventions; add `--write` to save local `.forgeflow/<project>/context/invocation-hints.*` files. |
| `/forgeflow-ownership` | Render advisory owner-surface recommendations from local topology, architecture, project operating-model, and optional CODEOWNERS evidence; add `--write` to save local `.forgeflow/<project>/context/ownership-map.*` files. |
| `/forgeflow-dogfood-refresh-plan` | Show the ordered local refresh commands needed before rerunning the dogfood report; read-only and does not run those commands. |
| `/forgeflow-dogfood-report` | Review Phase 8-11 local evidence and context-pack signals, then recommend keep, refine, or consider narrow opt-in automation promotion; add `--write` to save local `.forgeflow/<project>/context/dogfood-report.*` files. |
| `/forgeflow-code-map` | Generate a compact project code map with topology, sections, changed-section hints, import-gap triage, living project-map categories, Git provenance, and generated artifact paths. |
| `/forgeflow-command-args` | Validate a small command-argument string against an explicit allowlist without executing the command. |
| `/forgeflow-command-wrapper-batch` | Rank the next small batch of command-wrapper contract cleanup candidates without editing command files. |
| `/forgeflow-compact-output` | Compact allowlisted noisy command output while preserving exact output for unsafe command classes. |
| `/forgeflow-context-advisor` | Show context budget, savings, topology coverage, trend deltas, and proof-preserving trim recommendations. |
| `/forgeflow-context-contract` | Check generated agent packets against the context contract, required sections, size limits, and advisory-boundary wording. |
| `/forgeflow-context-retention` | Review local context artifact freshness, history retention, and broad packet size signals without deleting, compacting, or refreshing files. Add `--preview-cleanup` for read-only manual cleanup candidates. |
| `/forgeflow-context-wave-plan` | Plan smaller review waves when the latest context pack is over budget; use `--write-wave-files` to generate focused file-list inputs. |
| `/forgeflow-context-wave-build` | Build the first focused context packet from the latest over-budget wave plan, then report post-build budget status, verification command, and focused-packet handoff without spawning reviewers. |
| `/forgeflow-capture-output` | Compact provided command output safely and optionally save a failure digest without executing the command. |
| `/forgeflow-efficiency-gaps` | Plan the five largest current efficiency gaps across live context budget state, outcome calibration, user profile readiness, runtime inventory, failure-digest use, and telemetry sparsity without writing records or changing behavior. |
| `/forgeflow-failure-digest` | Build a compact failure digest from test, typecheck, lint, or log output, with Git provenance for freshness checks. |
| `/forgeflow-first-run` | Print a compact net-new user guide for install verification, project orientation, profile readiness, one bounded work item, and stop conditions. |
| `/forgeflow-first-run-result` | Record public-safe local first-run outcome evidence under `.forgeflow/<project>/first-run-results/`. |
| `/forgeflow-first-run-rollup` | Summarize aggregate first-run result evidence and onboarding friction without sharing raw records. |
| `/forgeflow-first-run-simulator` | Simulate a fresh-user first-run path with release version evidence, source-smoke readiness, and the next runtime-specific first command without installing or updating. |
| `/forgeflow-first-task-adoption-loop` | Decide whether the first real task should repeat, fix, defer, or expand based on first-task and useful-win evidence. |
| `/forgeflow-first-task-report` | Summarize first real work-item success signals, blockers, evidence, and next adoption action. |
| `/forgeflow-first-useful-win` | Summarize early public-safe wins from first-run results, pilot evidence, agent feedback, and learning status. |
| `/forgeflow-noisy-command` | Get advisory-only suggestions for narrower noisy command invocations. |
| `/forgeflow-drift` | Check whether agent prompts have drifted from canonical shared intelligence references using the script-backed drift helper. |
| `/forgeflow-health` | Audit installation, project-local state, latest project-learning quality, latest-insights readiness/freshness, and latest failure-digest freshness; can safely repair `.forgeflow/` scaffolding and budget config. Stale latest insights recommend `/forgeflow-trends --refresh`. |
| `/forgeflow-learnings --project --check` | Refresh and print current-project learnings, run the quality gate, smoke-test context-pack injection, and report whether latest insights are ready for agent context. Cross-project mode uses the pattern-learnings rollup helper across legacy learnings and project-learning candidates. |
| `/forgeflow-health-timeline` | Show a read-only local timeline across code-map history, context-advisor history, latest-insights readiness, learning-signal quality, comparable deltas, and project-map evolution. |
| `/forgeflow-insight-injection` | Show which local insight blocks were included, downgraded to metadata-only, or skipped in the latest agent context packets, with optional baseline diff, per-agent signal contracts, and clearing commands. |
| `/forgeflow-learning-policy` | Show, seed, or compare the local learning-signal decay policy consumed by `/forgeflow-learning-status`. |
| `/forgeflow-learning-action` | Route the weakest local learning or telemetry source to one concrete capture/check command before agents rely on calibration. |
| `/forgeflow-learning-capture-nudge` | Show the exact local capture command to run after review, next-work, agent-feedback, or first-run events without inventing observed values. |
| `/forgeflow-learning-status` | Show one compact local health view across project learnings, user profile, agent feedback, review outcomes, next-work outcomes, first-run results, and the project operating model, grouped into fix-first, watch, healthy lanes, signal-quality scores, and outcome-capture commands for missing calibration streams. |
| `/forgeflow-lean-audit` | Run a read-only repo-wide lean audit for avoidable dependencies, one-caller abstractions, delegating wrappers, future-proofing, and lean shortcut debt. Add `--write` to save `.forgeflow/<project>/context/lean-audit.md` and `.json`. |
| `/forgeflow-lean-adapter-contract` | Validate the lean adapter matrix, plugin hook wiring, managed helper inventory, and lean command wrappers without installing adapters or editing settings. |
| `/forgeflow-lean-adapter-drift` | Check committed lean adapter instruction copies against canonical generated lean rules and safety invariants. |
| `/forgeflow-lean-adapter-smoke` | Smoke-test committed lean adapter manifests and plugin wrappers without launching host applications. |
| `/forgeflow-lean-behavior` | Evaluate an output file or inline text for lean behavior probes: calibration boundary, requested explanation preservation, one runnable check, dependency justification, stdlib/native/reuse evidence, and explicit requirement preservation. |
| `/forgeflow-lean-benchmark` | Compare local baseline and lean-guided aggregate metrics. Use `--baseline <json> --current <json>` for explicit inputs, or default to `.forgeflow/<project>/context/lean-benchmark-baseline.json` and `lean-report.json`. Add `--write` to save `.forgeflow/<project>/context/lean-benchmark.md` and `.json`. |
| `/forgeflow-lean-benchmark-results` | Validate aggregate benchmark result metadata, correctness gates, cost/latency metrics, and session-cost caveats before publishing lean performance claims. |
| `/forgeflow-lean-benchmark-runner` | Render an opt-in benchmark runner scaffold with task arms and explicit model-runner commands; default output never calls models or the network. |
| `/forgeflow-lean-correctness` | Run executable local correctness canaries that accept known-good snippets and reject known lazy-wrong snippets. |
| `/forgeflow-lean-debt` | Build a local ledger from `forgeflow:` markers, lean-decision ceilings, and implementation-note upgrade triggers; flags shortcuts that do not name when to revisit them. Add `--write` to save `.forgeflow/<project>/context/lean-debt.md` and `.json`. |
| `/forgeflow-lean-decision` | Show read-only minimum-sufficient-solution guidance for a work item, including reuse candidates, avoid-first guidance, do-not-simplify boundaries, validation minimum, known ceiling, and upgrade trigger. `/consult`, `/implement`, Codex consult/implement skills, and generated project-intelligence brief stubs carry the same compact lean section into handoffs when available. `/implement` also writes a JSON sidecar that `record-implementation-notes.js --lean-decision` can append as a ceiling tradeoff note. |
| `/forgeflow-lean-eval` | Run the local deterministic lean eval pack against fixture outputs. It checks behavior-probe expectations without calling models, running generated code, installing dependencies, or using the network. |
| `/forgeflow-lean-hook-contract` | Run the lean activation hook subprocess contract when local process spawning is available; sandbox denial is reported as an environment-blocked warning. |
| `/forgeflow-lean-host-adapters` | Validate committed lean host adapter artifacts for plugin, extension, instruction, and skill-tier hosts. |
| `/forgeflow-lean-host-command-parity` | Check that pi registered lean commands have matching Forgeflow and OpenCode command files. |
| `/forgeflow-lean-host-packages` | Render host package guidance for lean adapters. Add `--write` to save `.forgeflow/<project>/lean-packages/manifest.json` and `README.md`. |
| `/forgeflow-lean-lab` | Compare baseline, balanced, strict, and ultra guidance across repeatable local task-pack results. Use `--task-pack <json> --results <json>` for explicit inputs; add `--write` to save `.forgeflow/<project>/context/lean-lab.md` and `.json`. Rankings require visible sample size and passing validation evidence. |
| `/forgeflow-lean-mode` | Show or persist the lean guidance profile. Use `--profile off|lite|balanced|strict|ultra --write` for project policy, or add `--user --write` for a user-level default. The mode is advisory and only affects whether/how compact lean guidance is injected into context packs and lean session hooks. |
| `/forgeflow-lean-openclaw-skill` | Check or regenerate the committed OpenClaw lean skill from the canonical lean rule text. |
| `/forgeflow-lean-pi-smoke` | Run the committed pi extension tests for lean command registration, mode changes, aliases, and before-agent prompt injection. |
| `/forgeflow-lean-portability` | Generate or check portable lean rule copies for generic agents, Cursor, Windsurf, Cline, Copilot, Copilot CLI, Kiro, OpenCode, Gemini/Antigravity, OpenClaw-style skills, and skill-style adapters. Add `--write` to save `.forgeflow/<project>/lean-portability/`. |
| `/forgeflow-lean-prime` | Show a single first-run checklist for lean mode, decision evidence, report evidence, telemetry quality, and context-injection eligibility, with one next command to clear the first blocker. |
| `/forgeflow-lean-report` | Summarize local aggregate lean-delivery signals and dogfood readiness. Add `--write` to save `.forgeflow/<project>/context/lean-report.md` and `.json`. |
| `/forgeflow-lean-review` | Show a separate read-only over-engineering review lane for current diff or `--diff <path>`, using only `delete`, `stdlib`, `native`, `reuse`, `yagni`, `shrink`, and `prose-bloat` tags. Findings include static project evidence, confidence, replacement guidance, estimated net lines, why-safe/why-not-safe evidence, proof steps, dependency deltas, and optional `forgeflow: lean` markers when available. Clean diffs end with `Lean already. Ship.` |
| `/forgeflow-lean-robustness` | Run deterministic known-good versus known-lazy-wrong checks for common shortcut correctness traps. |
| `/forgeflow-lean-rule-canary` | Check load-bearing lean rule invariants across canonical rule, session text, docs, and adapter target surfaces, including trust-boundary validation, data-loss prevention, security, accessibility, explicit requirements, calibration, and one runnable check. |
| `/forgeflow-lean-session` | Render compact always-on lean session guidance plus `LEAN:<profile>` statusline text for hook or adapter experiments. The managed lean activation hook uses the same canonical rule text when wired by the user. |
| `/forgeflow-lean-skills` | Check or regenerate committed `skills/forgeflow-lean*/SKILL.md` packages from the canonical lean rule text. |
| `/forgeflow-lean-status` | Show whether lean guidance is configured, blocked, or eligible for context-pack injection, including policy, lean-decision/report readiness, latest-insights, profile, operating-model, telemetry, helper availability, and automatic consult/implement/review/ship wiring. |
| `/forgeflow-lean-windows-smoke` | Run local compatibility checks for lean hook state paths and statusline badges with Windows-style environment variables present. |
| Automatic lean advisory | `/review` writes `context/latest/lean-review.md` and `.json` when the helper is available, and `/ship` reports lean-readiness gaps when a lean decision lacks report or ceiling evidence. These signals are advisory and do not change review verdicts or apply fixes. |
| `/forgeflow-pattern-review` | Review dry-run cross-project pattern promotion candidates with sample citations, redaction checklist, and manual-promotion boundary. |
| `/forgeflow-post-release-install-verify` | Show one read-only after-update verdict across release verification, install consumability, and downstream smoke. |
| Project intelligence rollup | `scripts/forgeflow/build-project-intelligence.js --json` writes one compact review-prep and next-work summary with trust state, Git provenance, top risks, refresh-first, read-first, avoid-first, validate-first, and proof-boundary guidance. Use `--next-work` for only the human-readable advisory next-work candidates, or `--brief <index>` for an advisory implementation-brief stub with suggested review lanes, implementation-notes seed prompts, and a handoff checklist. First-run fallback guidance starts with install health and project orientation when no stronger signal exists. |
| `/forgeflow-metrics` | Summarize telemetry, calibration, outcomes, context savings, budget health, and advisor actions. |
| `/forgeflow-next-action-audit` | Spot-check representative helper next actions for command-only copy-pastable values and direct explanatory text into `next_reason`. |
| `/forgeflow-next-work-ranking` | Rank next-work candidates from current local evidence, confidence, demotion, and validation signals, including copy-ready outcome prompts, without refreshing artifacts or auto-selecting work. |
| `/forgeflow-next-work-outcome` | Record local advisory feedback on whether a next-work recommendation was useful, ignored, incorrect, or blocked. |
| `/forgeflow-outcome-capture-plan` | Show missing local outcome evidence streams, concrete recorder prompts, and per-stream observed-evidence runbooks without writing records. |
| `/forgeflow-output-contract` | Spot-check representative helper output for status, next, reason, and advisory boundary fields. Add `--lean-file <path>` to warn on overlong generated lean handoffs while preserving raw-required evidence. |
| `/forgeflow-pilot` | Print the repeatable maintainer pilot script by default, or add `--path new-user` for the state-aware first-real-task evaluation path with guided repair, release-readiness preview, project intelligence, living map status, agent-feedback signal, and a public-safe result template. |
| `/forgeflow-profile` | Show, check, or record local advisory user operating preferences and project experience preferences for context-pack injection. |
| `/forgeflow-profile-bootstrap` | Preview explicit operating and project experience preference records, show required and optional prompt groups plus a guided setup path, then write only with `--write`. |
| `/forgeflow-profile-review` | Group profile conflicts, scope moves, ask-user prompts, cleanup actions, injection eligibility, safe next steps, confirmation prompts, explicit accept/reject/supersede/defer options, and a resolution flow before agent-heavy work. |
| `/forgeflow-project-brief` | Summarize existing local project intelligence into a concise read-only decision brief with recent changes, avoid-first, validate-first, and high-care file guidance for the next work item. |
| `/forgeflow-project-model` | Build and show the local advisory project operating model with domains, high-care files, risk zones, validation norms, operating preferences, agent guidance, review policy hints, proof boundaries, and append-only drift history. |
| `/forgeflow-report` | Produce a script-backed status report including local metrics, false-positive thresholds, pattern freshness, context trends, project trends, import-gap status, latest-insights readiness/freshness, latest failure-digest status/freshness, and direct next-action recommendations. Add `--refresh` to update project guidance first. |
| `/forgeflow-review-auto-classify` | Preview `/review-auto` safe, risky, and blocker buckets from captured findings JSON without editing files. Safe means future sandbox proposal eligibility only; unknown classes remain risky and denylisted surfaces are not auto-applicable. |
| `/forgeflow-review-auto-evidence` | Write a local review-auto classification evidence artifact from captured findings JSON, including policy version, class, proposal eligibility, sandbox-required flag, and matched rules. |
| `/forgeflow-review-autofix-apply` | Apply one selected, validated sandbox proposal after tracked-worktree, source-match, and validation checks; failed validation rolls back the changed file and records local evidence. |
| `/forgeflow-review-autofix-sandbox` | Run an explicit deterministic review-auto proposal in an isolated temp sandbox, run declared focused validation there, and write local proposal artifacts without mutating the source checkout. |
| `/forgeflow-review-autofix-status` | Show proposal input, sandbox proposal, apply artifact, apply history, failure/rollback, and next safe action status without mutating the checkout. |
| `/forgeflow-review-evidence-schema` | Validate captured review findings JSON shape and obvious safety hazards before auto-classification. |
| `/forgeflow-repair` | Show a non-mutating guided repair plan that combines offline version status, installed runtime helper checks, health failures, repair commands, manual settings guidance, and an explicit downstream smoke follow-up. |
| `/forgeflow-runtime-drift` | Compare source runtime helpers against installed runtime helpers and report grouped missing files, content drift, mode-only drift, syntax failures, and optional `--preview-repair` actions without repairing. Missing/content/syntax drift is actionable; mode-only drift is informational. |
| `/forgeflow-release-check` | Run local pre-release checks for command coverage, install, update, health, version, and context helpers. |
| `/forgeflow-release-readiness` | Run advisory local release readiness checks, verify runtime helper sources are present, managed, regular files, and inside the checkout, group blockers by readiness area, and avoid tagging, pushing, publishing, or GitHub calls. The helper also supports `--baseline <json>`, `--compare-last`, and `--save-current` for prior-run comparison. |
| `/forgeflow-release-follow-through` | Check post-publish release verify, update verify, and runtime-consumability follow-through without mutating release or install state. Add `--save` to persist the latest local follow-through snapshot. |
| `/forgeflow-release-consumption` | Roll up release follow-through into a compact consumed-or-attention summary. Add `--with-smoke` to explicitly run downstream smoke, or `--save` to persist a local release-consumption snapshot. |
| `/forgeflow-release-consumption-loop` | Show the ordered post-release update, downstream smoke, release-consumption loop, and read-only dogfood report with a downstream efficiency trial checklist and complete or attention badge without running update, repair, smoke, or snapshot writes. |
| `/forgeflow-release-verify` | Print the compact local post-publish summary for sharing, with installed-version/runtime-drift consumability evidence, optional local snapshot save/comparison, and explicit `--github` read-only remote evidence. |
| `/forgeflow-smoke` | Run downstream readiness smoke by default; add `--mode source` for source-tree release guards or `--mode full` for both groups. |
| `/forgeflow-support` | Write a local support bundle with version, health, smoke, plan-only release readiness with post-publish verification, code-map acceptance health, docs drift, project trends, and consolidated next actions. Treat it as local support data because it may include local paths. |
| `/forgeflow-sync` | Sync selected shared Forgeflow state with a team-owned git remote; local agent notes stay per-user and are never synced. |
| `/forgeflow-stale-artifact-plan` | Show minimal refresh commands for stale local guidance artifacts without refreshing or deleting them. |
| `/forgeflow-telemetry-quality` | Summarize whether local telemetry and outcome evidence are strong enough for calibration, including trusted sources, weakest sources, confidence, evidence ladder, and one next quality action. |
| `/forgeflow-trends` | Show the current project's code-map trend, operating-model drift, living project-map categories, import-gap status, artifact freshness, latest-insights readiness/freshness, latest failure-digest provenance/freshness, project-learning consumption, and context-advisor status. Add `--refresh` to refresh project learnings and latest-insights readiness first; stale reports recommend it directly. |
| `/forgeflow-update-verify` | Verify installed version state and runtime drift after update or repair, then print ready, restart, or repair guidance that separates source/install drift from other runtime drift needing repair. |
| `/forgeflow-validation-plan` | Plan focused validation commands from changed files, state when full suite or source smoke is required, and show compact failure-capture commands for failed checks. |
| `/forgeflow-validation-failure-capture` | Map a failed validation command to the safest output-capture mode and failure-digest path without executing it. |
| `/forgeflow-review-wave-prep` | Show the first focused review-wave command plus follow-through readiness when context is over budget. |
| `/forgeflow-version` | Show installed commit, upstream status, latest release, helper paths, grouped runtime helper inventory, missing helper sources, and the next update or repair action. Add `--snapshot` to write a local support artifact. |
| `/forgeflow-workflow-ending-capture` | Recommend the one outcome recorder command to consider after review, next-work, or agent-feedback workflow endings, including required evidence values, the matching learning-capture nudge, and observed-evidence stop rule. |
| `/forgeflow-workflow-readiness` | Show the next safe workflow-readiness action and automation runbook across review waves, calibration, profile, telemetry, and runtime inventory while keeping high-risk `/review` safe-args work paused. |
| `/forgeflow-wrapper-drift-plan` | Group command-wrapper drift into safe mechanical, manual, and high-risk buckets with validation commands. |
| `/sync-upstream` | Sync Forgeflow meta-work from `~/.claude/` back into the Forgeflow repo, then optionally commit and push. |
| `/ui-iterate` | Run measured UI/theme iteration with Playwright screenshots, accessibility scoring, variant ranking, and a local report. |
| `/ship` | Prepare presentation, PR, CI checks, and release handoff after a passing review-history gate; potential secrets are hard blockers. |

## Reference-Only Command Docs

Some command files document setup surfaces rather than normal interactive commands:

| Page | Purpose |
|---|---|
| `/ci-wrapper` | GitHub Actions PR-review wiring guide for the headless CI wrapper, budget config, verdict JSON schema, rollout gates, and auth requirements. |

Living project-map categories include baseline, missing-history, new hotspot, cooling hotspot, import-gap growth/reduction per metric, changed-section churn, graph-growth score, and stable structure. They are static JS/TS import and section signals only.

Context packs include a compact living-map guidance block for reviewers and synthesis. It is prioritization guidance only, not a finding, runtime proof, or dependency severity model.

Release-readiness blockers include a kind. `execution-environment` means the local runner could not spawn a documented check because local process spawning was denied. Run that listed command directly in the same trusted local environment used for release validation, or rerun release readiness where local process spawning is permitted. `missing-command` means a local executable or PATH prerequisite is missing and should be restored before rerunning readiness. The release-to-install preflight checks source-tree presence and ownership only; syntax, helper contract, update, health, and installed-runtime behavior are still verified by the release-check commands.

Use `scripts/forgeflow/test-doc-links.js --report` when release docs drift and you need an actionable Markdown report instead of only failing test lines.

## Codex Skills

Codex users can invoke skills directly:

```text
$discuss
$research
$plan
$consult
$implement
$forge-review
$ship
```

## Context Helpers

The review and implementation skills use local helpers when available:

```bash
scripts/forgeflow/build-context-pack.js --json
scripts/forgeflow/build-code-topology.js --json
scripts/forgeflow/show-code-map.js --json
scripts/forgeflow/build-memory-context.js --json
scripts/forgeflow/build-scope-manifest.js --json
scripts/forgeflow/record-implementation-notes.js --json
scripts/forgeflow/record-project-learning.js --json
scripts/forgeflow/check-implementation-notes.js --json
scripts/forgeflow/check-project-learnings.js --json
scripts/forgeflow/show-user-profile.js --json
scripts/forgeflow/check-user-profile.js --json
scripts/forgeflow/render-profile-review.js
scripts/forgeflow/record-user-profile.js --scope global --category communication --preference "Keep updates concise."
scripts/forgeflow/record-first-run-result.js --project-dir .forgeflow/Forgeflow --runtime codex --health pass --smoke pass --profile pass --decision continue
scripts/forgeflow/rollup-first-run-results.js --project-dir .forgeflow/Forgeflow
scripts/forgeflow/render-first-run-simulator.js --runtime codex --json
scripts/forgeflow/render-first-useful-win.js --project-dir .forgeflow/Forgeflow
scripts/forgeflow/next-action-contract.js --project-dir .forgeflow/Forgeflow
scripts/forgeflow/classify-review-auto.js --findings .forgeflow/Forgeflow/review-findings.json --json
scripts/forgeflow/render-architecture-docs.js --json
scripts/forgeflow/render-invocation-hints.js --json
scripts/forgeflow/render-ownership-map.js --json
scripts/forgeflow/render-dogfood-refresh-plan.js --json
scripts/forgeflow/render-dogfood-report.js --json
scripts/forgeflow/build-review-autofix-proposal.js --executor docs-reference --finding .forgeflow/Forgeflow/review-finding.json --file README.md --search "old text" --replace "new text" --json
scripts/forgeflow/run-review-autofix-sandbox.js --proposal .forgeflow/Forgeflow/review-auto/proposal-input.json --json
scripts/forgeflow/apply-review-autofix-proposal.js --proposal .forgeflow/Forgeflow/review-auto/proposals/<id>/proposal.json --json
scripts/forgeflow/show-review-autofix-status.js --json
scripts/forgeflow/check-review-evidence-schema.js --findings .forgeflow/Forgeflow/review-findings.json --json
scripts/forgeflow/command-args.js --allow "--json,--findings:path" --args "--json --findings .forgeflow/Forgeflow/review-findings.json" --json
scripts/forgeflow/render-command-wrapper-batch.js --root . --json
scripts/forgeflow/render-command-index.js --root . --json
scripts/forgeflow/record-next-work-outcome.js --project-dir .forgeflow/Forgeflow --title "Review profile guidance" --source user-profile --outcome useful
scripts/forgeflow/show-project-health-timeline.js --project-dir .forgeflow/Forgeflow
scripts/forgeflow/rollup-project-learnings.js --json
scripts/forgeflow/show-project-learnings.js
scripts/forgeflow/render-guided-repair.js
scripts/forgeflow/render-efficiency-gap-plan.js --root . --json
scripts/forgeflow/render-workflow-ending-capture.js --root . --event review --json
scripts/forgeflow/render-telemetry-quality.js --root . --json
scripts/forgeflow/render-learning-action-router.js --root . --json
scripts/forgeflow/render-release-readiness.js
scripts/forgeflow/render-release-verify.js
scripts/forgeflow/smoke-check.js --json
scripts/forgeflow/smoke-check.js --mode source --json
scripts/forgeflow/render-pilot-script.js --runtime codex
scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json
scripts/forgeflow/advise-context.js --root .forgeflow --record --json
```

These helpers produce bounded context packets, compact memory summaries, file ownership packets, budget warnings, trimming recommendations, learning quality views, and trend history. Context and memory helpers reject symlinked local artifact reads/writes and include untracked files in generated review/scope context.

## Implementation Notes

During `/implement`, Forgeflow keeps a local Markdown log at `.forgeflow/<project-name>/implementation-notes.md`. It captures decisions, spec gaps, tradeoffs, deviations, follow-ups, and validation notes that arise while building. See [Implementation Notes](Implementation-Notes) for the artifact contract and privacy rules.

For a Claude install created by `/update-forgeflow`, the helper root is:

```text
~/.claude/forgeflow/scripts/forgeflow/
```
