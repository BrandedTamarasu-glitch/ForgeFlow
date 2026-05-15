---
name: forgeflow-metrics
description: Summarize Forgeflow usage from telemetry logs — commands invoked, verdicts, verifier decisions, calibration, outcomes, per week/month
argument-hint: "[--period week|month|all (default month)] [--project <name>] [--json] [--calibration] [--outcomes <jsonl>]"
allowed-tools:
  - Read
  - Bash
  - Glob
---
<objective>
Read `forgeflow-metrics.jsonl` across the user's projects and produce a summary of Forgeflow usage. Data comes from the `forgeflow-telemetry.js` PostToolUse hook, which records commands, verdicts, Aegis decisions, auto-fix outcomes, and fleet shard completions.

Answers: Are `/review-auto` / `/fleet` / `/ui-iterate` actually being used? What's the verdict distribution? Is `/review-auto` reducing round count? Which projects churn vs. ship clean?
</objective>

<context>
$ARGUMENTS:
- `--period week|month|all` — window to summarize (default: month)
- `--project <name>` — filter to a single project (default: all projects)
- `--json` — raw JSON output instead of markdown summary
- `--calibration` — also generate per-agent/per-class calibration using `scripts/forgeflow/summarize-calibration.js` when available
- `--outcomes <jsonl>` — summarize local review outcome records using `scripts/forgeflow/record-review-outcome.js` when available

Reads from `~/.claude/projects/<sanitized-cwd>/memory/forgeflow-metrics.jsonl` across all project dirs.
</context>

## Gotchas
- **Passive instrumentation, not authoritative.** Telemetry comes from a PostToolUse hook — if the hook failed or was disabled, events are lost. Missing data ≠ zero usage. The hook is fail-open by design; silent gaps are expected.
- **Verdict detection is regex-based on Agent output.** If an agent's verdict line format drifts (e.g., new verdict category), the hook misses it. Check `hooks/forgeflow-telemetry.js` `detectEvents()` when Forgeflow output formats change.
- **Command invocation is inferred, not direct.** The hook detects `/handoff` via `.claude/handoff.md` writes, `/fleet` via worktree removal, `/review-auto` via `chore(auto-fix)` commits. A command aborted before producing its signature artifact won't register.
- **Multi-project summaries assume project name uniqueness.** Two projects both named `api` will merge in the summary. Use `--project` to disambiguate via path.
- **No retention policy.** JSONL files grow forever. For long-running setups, archive older logs manually: `gzip ~/.claude/projects/<old-project>/memory/forgeflow-metrics.jsonl`.

<process>

## Step 1: Collect metrics files

```bash
find "$HOME/.claude/projects" -name "forgeflow-metrics.jsonl" -type f 2>/dev/null
```

If no files found, exit:
```
No Forgeflow telemetry found.

The telemetry hook writes to ~/.claude/projects/<project>/memory/forgeflow-metrics.jsonl
on PostToolUse events. If you have not yet invoked /review, /review-auto, /fleet,
/ui-iterate, /handoff, or /ship in an instrumented session, there is nothing
to summarize yet.

Verify the hook is wired:
  cat ~/.claude/settings.json | grep forgeflow-telemetry
```

## Step 2: Parse period filter

```bash
PERIOD="${PERIOD:-month}"
case "$PERIOD" in
  week)  CUTOFF=$(date -u -d '7 days ago' --iso-8601=seconds) ;;
  month) CUTOFF=$(date -u -d '30 days ago' --iso-8601=seconds) ;;
  all)   CUTOFF="1970-01-01T00:00:00Z" ;;
esac
```

## Step 3: Aggregate events

For each jsonl file:
- Filter events where `ts >= CUTOFF`
- If `--project` specified, filter where `project == <name>`
- Tally by event type and command

Aggregate bins:
- **Invocations per command** — `command-invoked` + inferred invocations (verdict implies `/review`, auto-fix-round implies `/review-auto`, etc.)
- **Verdicts per command** — count APPROVE / CONDITIONAL APPROVE / REVISE / BLOCK + CONFIRM / CHALLENGE
- **Auto-fix metrics** — total rounds, rounds-to-APPROVE distribution, worker success rate (SUCCESS / MULTI-FILE / NOT FOUND / UNEXPECTED)
- **Verifier metrics** — `finding-verified` counts by CONFIRMED / REJECTED / BLOCKED
- **Calibration summary** — when `--calibration` is passed and the helper exists, include per-agent/per-class overturned, verified, confirmed, rejected, blocked, and auto-fix counts
- **Outcome summary** — when `--outcomes <jsonl>` is passed and the helper exists, include accepted/rejected finding totals, verifier decisions, review minutes, auto-fix success, and post-merge regression signal
- **Context savings** — include local `context-telemetry.json`, `memory-context-telemetry.json`, and `scope-telemetry.json` artifacts when present under `.forgeflow/<project>/context/`
- **Fleet metrics** — shard-complete counts
- **Per-project breakdown** — top 5 projects by invocation count

## Step 4: Render summary

If `--json`, dump aggregated data structure verbatim.

Otherwise, markdown table:

```markdown
# Forgeflow — Metrics (<period>)

## Invocations
| Command | Count | % of total |
|---|---|---|
| /review | 47 | 42% |
| /review-auto | 22 | 20% |
| /ship | 18 | 16% |
| /handoff | 14 | 13% |
| /fleet | 6 | 5% |
| /ui-iterate | 4 | 4% |

## Verdicts
| Reviewer | APPROVE | CONDITIONAL APPROVE | REVISE | BLOCK |
|---|---|---|---|---|
| Arbiter | 28 | 3 | 12 | 4 |
| Compass | 29 | - | - | 18 CHALLENGE |

## /review-auto
- Total rounds: 38 (across 22 invocations, avg 1.7)
- Rounds-to-APPROVE: 1 round = 14, 2 rounds = 6, 3+ rounds = 2
- Worker success rate: 91% SUCCESS, 5% MULTI-FILE, 2% NOT FOUND, 2% UNEXPECTED

## Neutral verifier
- Confirmed: 12
- Rejected: 5
- Blocked: 3

## /fleet
- Total shards completed: 15 (across 6 invocations)
- Avg shards per invocation: 2.5

## Top projects
| Project | Invocations | REVISE rate |
|---|---|---|
| campaign-management | 35 | 48% |
| llama.cpp | 22 | 22% |
| Forgeflow | 18 | 11% |
| SubAgents | 14 | 14% |

## Signals
- /review-auto cutting round count: yes (64% of REVISEs close in 1 auto-fix round)
- /fleet usage: infrequent (6 invocations in 30 days — reassess priority of monorepo mode)
- /ui-iterate usage: light (4 invocations — still validating the fitness loop)
```

When `--calibration` is passed:

```bash
scripts/forgeflow/summarize-calibration.js --json
```

When `--outcomes <jsonl>` is passed:

```bash
scripts/forgeflow/record-review-outcome.js --summary <jsonl> --json
```

When context telemetry artifacts exist:

```bash
scripts/forgeflow/summarize-context-telemetry.js --root .forgeflow --json
scripts/forgeflow/check-context-budget.js --root .forgeflow --max-compact-tokens 16000 --warn-only --json
scripts/forgeflow/advise-context.js --root .forgeflow --json
```

Budget defaults can be overridden with repo-local `.forgeflow-budget.json`:

```json
{
  "max_compact_tokens": 16000,
  "warn_only": true,
  "kind_limits": {
    "context-pack": 16000,
    "memory-context": 8000,
    "scope-manifest": 6000
  }
}
```

To seed the config in a project without overwriting an existing file:

```bash
scripts/forgeflow/seed-budget-config.js --json
```

## Step 5: Signals section (interpretation)

Compute and include:
- **Closed-loop effectiveness** — `(auto-fix rounds that led to APPROVE) / (total auto-fix rounds)`
- **Command adoption** — for each V4.2 command, is count > 5 in the period? If no, flag as "under-adopted — reassess"
- **Verdict churn** — per project, `REVISE count / total review count`. If > 50%, flag as "high churn — investigate root causes"
- **Context savings trend** — compare estimated saved tokens by kind; if context-pack savings are low, review packet contents for over-inclusion
- **Context budget health** — report any telemetry artifact whose compact token estimate exceeds the configured budget
- **Context advisor actions** — include `scripts/forgeflow/advise-context.js` recommendations for low savings, budget violations, or missing telemetry

</process>

<success_criteria>
- [ ] Aggregated metrics across all `forgeflow-metrics.jsonl` files in `~/.claude/projects/`
- [ ] Period filter applied correctly (week/month/all)
- [ ] Project filter applied when `--project` specified
- [ ] Signals section interprets numbers (not just lists counts)
- [ ] `--json` produces structured output suitable for piping
- [ ] Absent telemetry surfaces a clear "nothing to summarize yet" message with wiring instructions
</success_criteria>
