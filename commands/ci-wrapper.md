---
name: ci-wrapper
description: Reference documentation for the GitHub Actions PR review workflow shipped with V5.0 Phase 2. Not a user-invocable command — pages here read as the setup guide for per-repo CI wiring.
---

# CI Wrapper — Wiring Guide

V5.0 Phase 2 (Theme A) ships a headless Forgeflow runner that executes on every PR and posts a verdict comment. This page is the reference for wiring it into a repo.

Components shipped:
- `.github/workflows/forgeflow.yml` — GitHub Actions workflow
- `.github/forgeflow-budget.yml` — per-repo config for cost ceiling + behavior mode
- `scripts/forgeflow-pr-review.sh` — bash wrapper that invokes `claude -p /review --ci` and posts the comment
- `docs/forgeflow-json-schema.md` — machine-parseable verdict schema v1
- `/review --ci` flag — suppresses markdown narrative and emits the JSON verdict block

---

## Two-sided install model

Phase 2 CI has two independent surfaces:

1. **Target repo infrastructure** — the workflow, budget config, and wrapper script committed into the repo under review. These tell GitHub Actions what to do on each PR.

2. **Runner-side Forgeflow install** — the agents, commands, hooks, and canonical intelligence files in `~/.claude/` on the CI runner. The workflow installs these at the start of every run (plugin install preferred; fallback to repo clone). The target repo does NOT need the Forgeflow team files committed.

A repo with Phase 2 wired has only the four infrastructure files checked in. The Forgeflow team itself lives on the ephemeral runner for the duration of the job.

## One-time setup per repo

### 1. Copy the four Phase 2 files into the target repo

```bash
cd /path/to/target-repo
curl -sf https://raw.githubusercontent.com/BrandedTamarasu-glitch/ForgeFlow/main/.github/workflows/forgeflow.yml \
  -o .github/workflows/forgeflow.yml
curl -sf https://raw.githubusercontent.com/BrandedTamarasu-glitch/ForgeFlow/main/.github/forgeflow-budget.yml \
  -o .github/forgeflow-budget.yml
mkdir -p scripts
curl -sf https://raw.githubusercontent.com/BrandedTamarasu-glitch/ForgeFlow/main/scripts/forgeflow-pr-review.sh \
  -o scripts/forgeflow-pr-review.sh
chmod +x scripts/forgeflow-pr-review.sh
```

Or reference the workflow from `BrandedTamarasu-glitch/ForgeFlow` directly via workflow_call once that interface is shipped (V5.1 roadmap item).

### 2. Add the auth secret

Exactly one of the following must be in repo secrets:

- `CLAUDE_CODE_OAUTH_TOKEN` — preferred; issued via `claude auth token` after `claude auth login`. Tied to a Claude Code account; usage goes through that account's subscription.
- `ANTHROPIC_API_KEY` — direct API key from the Anthropic console. Usage bills to that account.

Add via `gh secret set`:

```bash
gh secret set CLAUDE_CODE_OAUTH_TOKEN --body "$(claude auth token)"
# OR
gh secret set ANTHROPIC_API_KEY --body "sk-ant-..."
```

The workflow passes both to the job; the wrapper requires at least one.

### 3. Review and edit `.github/forgeflow-budget.yml`

Defaults are conservative. Tune (all values must use the EXACT strings listed — the wrapper's validator rejects `yes`, `on`, `1`, `"true"` as substitutes for `true`; same for `false`):

| Key | Default | When to change |
|---|---|---|
| `max_cost_per_pr_usd` | `"1.00"` | Raise to cover larger diffs; lower to fail fast on runaway reviews |
| `mode` | `review-only` | Flip to `review-and-fix` once the Forgeflow team has proven accurate on the repo |
| `routing_cap` | `thin` | Raise to `full` when the Forgeflow team consistently returns useful full-mode findings. **`thin` is special** — it activates the classifier's CI cap (downgrades full→thin but preserves deep-mode for auth/migration/crypto paths). `full` / `deep` / `skip` are force-modes; they disable deep-mode escalation. Details in `.github/forgeflow-budget.yml` comments |
| `fail_action_on_revise` | `true` | Set to `false` for shadow-mode rollout (comment only, don't fail the check) |
| `comment_on_skip` | `false` | Set to `true` during initial rollout to verify the classifier |

### 4. Commit, open a PR, watch the Forgeflow team run

The workflow triggers on `pull_request` with types `opened`, `synchronize`, `reopened`. On first run you'll see the Forgeflow team comment within 2-5 minutes for a typical PR. Check the Actions tab if the comment does not appear — most issues are auth or plugin install failures surfaced clearly in the job log.

---

## Recommended rollout order

1. **Shadow mode (week 1).** `mode: review-only`, `routing_cap: thin`, `fail_action_on_revise: false`, `comment_on_skip: true`. Let the Forgeflow team comment on every PR without blocking merges. Read the comments; verify verdicts line up with your own review of the same PR.

2. **Gate mode (week 2).** Flip `fail_action_on_revise: true`. The Forgeflow team now fails the GitHub check on REVISE or BLOCK verdicts. Merges requiring green checks are blocked until the Forgeflow team clears.

3. **Full cap (week 3+).** Raise `routing_cap: full` once the Forgeflow team has landed 10+ sensible thin-mode verdicts. Full mode adds Lumen + Atlas + Compass to every non-trivial PR; cost roughly 3-4× thin mode.

4. **Review-and-fix (optional).** Flip `mode: review-and-fix` after 30+ PRs under gate mode with an acceptable false-positive rate (tracked via `/forgeflow-report`). Auto-fix is irreversible without a force-push revert — do not enable until confidence is high.

### Decision gate metric (Phase 2 rollout exit criterion)

Before advancing past shadow mode (week 1) to gate mode (week 2), the Forgeflow team must meet ALL three criteria across the first 5 consecutive PRs:

1. **Verdict alignment.** Maintainer agrees with Arbiter's verdict within ±1 tier (APPROVE ↔ CONDITIONAL_APPROVE ↔ REVISE ↔ BLOCK) on 5 of 5 consecutive PRs. Measure by comparing the Forgeflow team comment to the maintainer's own merge-or-block decision.
2. **Cost discipline.** Median `metadata.cost_estimate_usd` across the 5 PRs ≤ 80% of `.github/forgeflow-budget.yml` `max_cost_per_pr_usd`. Covers routine cost behavior without a single cheap PR hiding a blown budget on another.
3. **Zero silent failures.** No run that exits 0 but actually failed (e.g., claude crashed mid-stream, JSON parse succeeded on a stale block, budget check bypassed). A cost-efficient Forgeflow that hides failures is worse than no Forgeflow. Check via workflow artifact: verdict JSON present, `schema_version: "1"` matches, `reason` field populated when `verdict: SKIPPED | ABORTED`.

The measurement window is the first 5 PRs after Phase 2 lands. No rolling average, no cherry-picking. If any criterion fails on any of the 5, restart the window — the next PR becomes PR 1 of a fresh 5-PR window; earlier PRs are discarded, not averaged.

To advance past gate mode (week 2) to full-cap mode (week 3), repeat the same three criteria across the next 10 consecutive PRs at gate severity.

**Auto-fix gate mechanism.** The wrapper uses a NUMERIC gate, not a class-level whitelist. It counts findings eligible for auto-fix (nits + must_fix excluding hard-unsafe classes) and invokes `/review-auto` when at least one exists. `/review-auto` itself then performs the real tier + source-reviewer classification (NIT vs MUST-FIX-SAFE vs MUST-FIX-RISKY vs BLOCKER) per its rules in `commands/review-auto.md`.

The wrapper maintains a HARD-UNSAFE class list — findings with these tags always surface for manual review regardless of tier:

```
sql-injection, auth, secret, token, jwt, permission,
rbac, crypto, password, csrf, xss, ssrf
```

These match the class tag vocabulary Arbiter uses (`agents/arbiter-review.md`). Warden-flagged findings remain excluded at the source-reviewer check in `/review-auto` regardless of class tag — that is the second gate, orthogonal to this one.

Phase 1 Theme B output from `/forgeflow-report` is the primary signal for deciding when to advance. False-positive-heavy reviewers show up before they cause auto-fix regressions.

---

## Cost expectations

Rough per-PR cost, assuming `claude-opus-4-7`:

| Routing | Typical scenario | Estimated cost |
|---|---|---|
| `skip-mode` | Docs-only PR | ~$0.02 (classifier only) |
| `thin-mode` | 2-file bugfix, test-only PR | ~$0.15 |
| `full-mode` | Standard feature PR, 5-15 files | ~$0.60 |
| `deep-mode` | Auth / migration / crypto PR | ~$0.90 |
| `full-mode + chunking` | Large refactor, 30+ files | $1.50-2.40 |

The wrapper estimates cost from routing mode + diff size BEFORE spawning the Forgeflow team. If the estimate exceeds `max_cost_per_pr_usd`, the Forgeflow team aborts with a `budget-exceeded` comment and exits 2 (the check appears red; the PR author decides whether to raise the budget or split the diff).

---

## PR comment anatomy

The Forgeflow team's PR comment contains:

- **Header** — verdict icon + verdict label + 1-2 sentence summary
- **Routing table** — mode, cost estimate, duration, files reviewed
- **Findings sections** — Blockers, Must fix, Recommended (visible) + Nits, Boyscout (collapsed `<details>`)
- **Overturned findings** — collapsed `<details>` showing findings Arbiter dismissed as false positives (telemetry visibility)
- **Footer** — schema_version + mode + routing_cap for audit

Findings carry stable IDs (`B1`, `M1`, `R1`, etc.) so PR comments referencing them remain coherent across re-runs.

---

## Troubleshooting

### "Plugin marketplace unreachable"

The workflow falls back to a shallow clone of `BrandedTamarasu-glitch/ForgeFlow` and copies files directly. This is a resilience path, not a preferred path — raise a Forgeflow issue if it triggers on every run (indicates marketplace auth problem).

### "no verdict block found in claude output"

Claude ran but didn't emit the `<forgeflow-verdict-json>` block. Most common causes:

- `/review` command file out of date in the CI install (pre-V5.0 Phase 2). Verify by reading `~/.claude/commands/review.md` in the workflow and confirming it has Step 7.5.
- Claude Code CLI crashed mid-run. Check workflow logs for stack traces.
- `claude -p` timed out (30-min workflow timeout). Split the PR or increase `timeout-minutes` in the workflow.

### "schema version mismatch"

The wrapper pins to `schema_version: 1`. If the Forgeflow team shipped a v2, update the wrapper to match. This is a deliberate safety gate — consumers don't forward-compat-guess.

### "budget-exceeded on every PR"

`max_cost_per_pr_usd` is set too low for the repo's typical diff size. Raise it or tighten `routing_cap` to `thin`. Set `comment_on_skip: true` temporarily to see classifier output for further tuning.

### Forgeflow passes but the PR has real bugs the Forgeflow team missed

Expected. The Forgeflow team is a co-reviewer, not a replacement. Capture examples via `/forgeflow-report` false-positive tracking — when a reviewer misses the same class 3+ times, the prompt-refinement flag fires.

### Forgeflow fails on PRs with auto-generated code (translations, lockfiles, etc.)

Use path-level overrides in a future `.github/forgeflow-budget.yml` key (planned V5.1) or tag commits with `[skip Forgeflow]` in the subject line (planned V5.1). For now, run `/review --mode skip` locally and push that verdict via the workflow_dispatch path.

### Testing the workflow locally

Install [`act`](https://github.com/nektos/act) to run the workflow without pushing:

```bash
act pull_request \
  --secret ANTHROPIC_API_KEY=sk-ant-... \
  --eventpath fixtures/pr-event.json
```

Create `fixtures/pr-event.json` with a minimal pull_request event payload (number, base.ref, head.sha — copy the shape from an actual GitHub webhook delivery). This catches workflow syntax errors and secret-plumbing issues before they appear in a live PR.

---

## Security notes

- The workflow runs with `contents: write` and `pull-requests: write` permissions. The first is only used in `review-and-fix` mode to push `chore(auto-fix)` commits. If `mode: review-only` (default), `contents: read` is sufficient — tighten permissions manually when the auto-fix path is not needed.

- **Fork PRs.** GitHub downgrades `pull_request` workflow permissions to read-only for PRs from forks (even with `pull-requests: write` declared). The Forgeflow team can still run and emit a verdict JSON in the workflow logs, but it cannot post a PR comment or push auto-fix commits. For fork-heavy repos, either (a) use `pull_request_target` trigger with careful input validation (risky; review before enabling) or (b) accept that fork PRs get a log-only review and rely on maintainer-pushed branches for gate enforcement.

- The auth secret is injected as env var, never echoed to logs. If you see the token in workflow output, the runner or an install step is leaking — file a security issue.

- `scripts/forgeflow-pr-review.sh` does not execute untrusted input from the PR diff. All shell invocations take quoted arguments. Diff content is passed as data to `claude -p`, not as shell commands.

- The wrapper never force-pushes. Auto-fix commits are regular additions on the PR branch; PR authors retain full control.

---

## Monitoring

- `/forgeflow-metrics --period week` — usage + verdict distribution
- `/forgeflow-report --period month` — false-positive signal + drift
- Workflow artifact `forgeflow-verdict-<pr>-<run>.json` — raw verdict JSON retained for 14 days per run for debugging and dashboard ingestion
