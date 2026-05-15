---
name: forgeflow-report
description: Monthly executive summary of Forgeflow health. Aggregates telemetry, learnings, drift, and false-positive signals into one report. Flags reviewers that need prompt refinement and patterns that need curation.
argument-hint: "[--period week|month|quarter|all (default month)] [--no-drift] [--json]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

<objective>
Single report pulling together everything the self-improving Forgeflow machinery has captured:

1. **Invocations & verdicts** (from `forgeflow-metrics.jsonl`) — what the Forgeflow team did
2. **Auto-fix effectiveness** — did `/review-auto` close rounds?
3. **False-positive leaders** (from `finding-overturned` events) — which reviewer got overturned most, on which class
4. **Pattern promotions** (from `forgeflow-patterns/.learnings-log.jsonl`) — what `/forgeflow-learnings` added to the canonical library
5. **Drift status** (from `/forgeflow-drift --json`) — which agents lag their canonical reference
6. **Context savings** (from `.forgeflow/**/context-telemetry.json` and related context telemetry) — whether local context packing is reducing prompt load
7. **Recommendations** — specific agent prompts that need refinement based on the above

Answers: "Is the Forgeflow team getting smarter, and where is it getting stupider?"

Self-improving Forgeflow mechanic: run monthly. Output is the decision surface for curating agent prompts, promoting patterns, and retiring false-positive-prone checks.
</objective>

<context>
$ARGUMENTS:
- `--period week|month|quarter|all` — default: month (30 days)
- `--no-drift` — skip running `/forgeflow-drift` (faster; useful when drift was recently checked)
- `--json` — structured JSON output

Reads:
- `~/.claude/projects/<sanitized-cwd>/memory/forgeflow-metrics.jsonl` across all project dirs
- `forgeflow-patterns/.learnings-log.jsonl` (written by `/forgeflow-learnings`)
- Invokes `/forgeflow-drift --json` for drift snapshot (unless `--no-drift`)
</context>

## Gotchas

- **Telemetry is passive.** Missing data means the hook didn't fire, not that nothing happened. Report totals alongside any anomalously low counts.
- **False-positive tracking needs Arbiter's tag.** Overturn events only exist if Arbiter emitted the `- REVIEWER: ... | CLASS: ... | FINDING: ...` tag (added to `arbiter-review.md` in V5.0). Earlier reviews will not have overturn data; surface this explicitly rather than silently showing zeros.
- **Per-class threshold is 3.** A reviewer getting overturned on the same class 3+ times flags that agent's prompt for review. This matches the false-positive escalation policy.
- **Drift invocation is best-effort.** If `/forgeflow-drift` errors, the report still produces the other sections.

<process>

## Step 1: Resolve period

```bash
PERIOD="${PERIOD:-month}"
case "$PERIOD" in
  week)    CUTOFF=$(date -u -d '7 days ago' --iso-8601=seconds) ;;
  month)   CUTOFF=$(date -u -d '30 days ago' --iso-8601=seconds) ;;
  quarter) CUTOFF=$(date -u -d '90 days ago' --iso-8601=seconds) ;;
  all)     CUTOFF="1970-01-01T00:00:00Z" ;;
esac
```

## Step 2: Collect telemetry

```bash
find "$HOME/.claude/projects" -name "forgeflow-metrics.jsonl" -type f 2>/dev/null
```

Parse, filter events where `ts >= CUTOFF`. Bucket by event type.

## Step 3: Compute metrics

### 3a. Invocation + verdict aggregates (reuse `/forgeflow-metrics` math)

Produce:
- Total invocations by command
- Verdict distribution (APPROVE / CONDITIONAL APPROVE / REVISE / BLOCK / CONFIRM / CHALLENGE)
- Auto-fix rounds-to-APPROVE distribution
- Fleet shard counts

### 3b. False-positive tracking

From `finding-overturned` events:

```python
overturns_by_class = defaultdict(lambda: defaultdict(int))
# overturns_by_class[reviewer][class] = count

for event in events where event == 'finding-overturned':
    r = event.detail.overturned_reviewer
    c = event.detail.finding_class
    overturns_by_class[r][c] += 1

flagged = []
for reviewer, classes in overturns_by_class.items():
    for class_tag, count in classes.items():
        if count >= 3:
            flagged.append({"reviewer": reviewer, "class": class_tag, "count": count})
```

`flagged` becomes the "reviewer prompts that need refinement" list.

### 3c. Pattern promotion summary

Read `forgeflow-patterns/.learnings-log.jsonl`. Show:
- Last `/forgeflow-learnings` run date
- Total patterns applied vs candidates surfaced (cumulative in period)
- If last run was >60 days ago, flag "overdue"

### 3d. Drift snapshot

Unless `--no-drift`, invoke (captured stdout):

```bash
/forgeflow-drift --json
```

Parse; extract agents with any MISSING or DRIFTED sections. Report by drift_score.

### 3e. Context savings

When `scripts/forgeflow/summarize-context-telemetry.js` exists, run:

```bash
scripts/forgeflow/summarize-context-telemetry.js --root .forgeflow --json
scripts/forgeflow/check-context-budget.js --root .forgeflow --max-compact-tokens 16000 --warn-only --json
```

Include estimated saved tokens, percent saved by telemetry kind, and any context budget warnings. The budget checker reads `.forgeflow-budget.json` from the repo root when present.

## Step 4: Render output

If `--json`, dump the aggregated data structure.

Markdown (default):

```markdown
# Forgeflow — Monthly Report (<period>)

**Period:** <start> to <end>
**Projects active:** 5
**Generated:** <timestamp>

## 1. Activity

(Trend column requires ≥2 entries in `.report-log.jsonl`; shows `—` on the first run.)

| Command | Invocations | Trend vs. prior period |
|---|---|---|
| /review | 47 | ↑ 12 |
| /review-auto | 22 | ↑ 5 |
| /ship | 18 | flat |
| /handoff | 14 | ↑ 3 |
| /fleet | 6 | flat |
| /ui-iterate | 4 | ↓ 1 |

## 2. Verdicts

| Reviewer | APPROVE | CONDITIONAL | REVISE | BLOCK |
|---|---|---|---|---|
| Arbiter | 28 | 3 | 12 | 4 |
| Compass | 29 CONFIRM | — | — | 18 CHALLENGE |

## 3. Auto-fix effectiveness

- Total rounds: 38 across 22 invocations (avg 1.7)
- Rounds-to-APPROVE: 1-round = 14 (64%), 2-round = 6 (27%), 3+-round = 2 (9%)
- Worker success rate: 91% SUCCESS, 5% MULTI-FILE, 2% NOT FOUND, 2% UNEXPECTED

## 4. False positives (⚠️ actionable)

3 reviewer/class combinations exceeded the 3-overturn threshold:

| Reviewer | Class | Overturns | Representative finding |
|---|---|---|---|
| smith | n-plus-one | 7 | "batch loop flagged as N+1" (false) |
| warden | sql-injection | 5 | "interpolated token flagged as injection" (false) |
| smith | dry-violation | 3 | "INSERT + UPDATE blocks flagged as dupe" (false) |

**Recommendation:**
1. `smith` pre-flights are overtriggering on N+1 and DRY. Review `agents/_shared/smith-craft.md` — are the pre-flight gates strict enough?
2. `warden` is overturning SQL injection flags. The parameterization pre-flight in `/debate` is strong; consider promoting it into `warden-security-intelligence.md`.

(Absence of data means Arbiter has not yet emitted overturn tags — surfaces as: "No overturn data in period. Arbiter's prompt in `arbiter-review.md` now requires the tag; data will accrue.")

## 5. Pattern library

- Last `/forgeflow-learnings` run: <date> (<days> ago)
- Patterns applied (cumulative in period): 4
- Candidates surfaced, not yet promoted: 2
- Status: current | overdue

If overdue, output the literal instruction: "Run `/forgeflow-learnings` to refresh."

## 6. Drift

<inlined `/forgeflow-drift` summary — top 3 drifted agents>

## 7. This-month priorities

Auto-derived from the above:

1. Fix smith N+1 false-positive rate — refine pre-flight in `agents/_shared/smith-craft.md`
2. Resync `arbiter-review.md` — 2 DRIFTED sections from drift report
3. Promote the 2 learning candidates sitting in the last `/forgeflow-learnings` output — they've been surfaced for >30 days

## Signals
- Auto-fix rate >60% 1-round APPROVE → Forgeflow is well-calibrated on mechanical issues
- False-positive concentration in Smith → prompt-level issue, not reviewer-level
- Drift at 3 agents → do a resync sprint before next release
```

## Step 5: Self-log

Append to `forgeflow-patterns/.report-log.jsonl`:

```json
{"ts":"<ISO>","period":"<period>","total_invocations":N,"flagged_reviewers":M,"drifted_agents":K}
```

Lets future `/forgeflow-report` runs compute the "trend vs prior period" column by reading its own history.

</process>

<success_criteria>
- [ ] Single report combining all five signal sources (invocations, verdicts, auto-fix, false positives, drift)
- [ ] False-positive threshold correctly applied (3 overturns per reviewer+class)
- [ ] Pattern-library section shows last run + overdue flag
- [ ] Drift section uses live `/forgeflow-drift --json` (unless `--no-drift`)
- [ ] "This-month priorities" is auto-derived from the data, not a placeholder
- [ ] Trend column shows delta vs prior period when `.report-log.jsonl` has ≥2 entries
- [ ] `--json` produces pipe-friendly structured output
- [ ] `.report-log.jsonl` gets a new entry on every run
</success_criteria>
