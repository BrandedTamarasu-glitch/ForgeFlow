# Public-Safe Examples

These examples show the shape of Forgeflow output without exposing source code, private paths, customer data, tokens, or raw telemetry rows. Use them in adoption notes, demos, or screenshots when the real project output is sensitive.

## Install

```text
Forgeflow installed (abc1234)

Files synced (42):
  agents/smith-review.md  new -> 91f2a4c0d112
  commands/review.md  new -> a3d7e5b9c442
  scripts/forgeflow/health-check.js  new -> 18c0a51bf789

Rollback snapshot: ~/.claude/forgeflow/backups/previous
```

Safe to share:

- status line
- short commit SHA
- managed Forgeflow file names
- counts and hash-like file fingerprints

Do not share:

- private home directory names
- local repo names if sensitive
- shell history around the command

## Health

```text
Forgeflow - Health Check

Passing
- Agents: 26/26
- Shared reference files: 5/5
- Commands: 25/25 + 2/2 subdir
- Project rules: 2/2
- Hooks: 4/4 installed, 4/4 wired
- Runtime helpers: 26/26 present, all syntax-OK
- Version: up to date

Summary: all checks passing.
```

Safe to share:

- category counts
- pass/fail status
- generic remediation text

Do not share:

- full `settings.json`
- absolute private paths
- GitHub account names unless intentional

## Review

```text
Review route: full-mode
Agents: Smith, Warden, Lumen, Atlas
Routing reasons:
- frontend path changed
- service boundary touched
- calibration requires Aegis for noisy class: accessibility

Arbiter verdict: CONDITIONAL_APPROVE
Must fix: 1
Recommendations: 2
Compass validation: CONFIRM
```

Safe to share:

- route mode
- agent list
- aggregate finding counts
- final verdict
- sanitized routing reasons

Do not share:

- proprietary file names
- code snippets
- vulnerability details before disclosure approval

## Context

```text
# Forgeflow Context Savings

Files: 3
Estimated saved tokens: 18420
Percent saved: 63.5%

| Kind | Files | Baseline Tokens | Compact Tokens | Saved Tokens | Saved |
|---|---:|---:|---:|---:|---:|
| context-pack | 1 | 21000 | 7800 | 13200 | 62.9% |
| memory-context | 1 | 5200 | 1900 | 3300 | 63.5% |
| scope-manifest | 1 | 3300 | 1380 | 1920 | 58.2% |
```

Safe to share:

- token estimates
- savings percentages
- context kind names
- budget status and violation counts

Do not share:

- generated context packet contents
- raw memory summaries
- task text if it names private customers or projects

## Evaluation

```text
# Forgeflow Evaluation Summary

Reviewed changes: 12
Confirmed findings: 19
Rejected findings: 5
Confirmation rate: 79.2%
False positive rate: 20.8%
Average review minutes: 18.6

Workflow comparison:
- no-agent: 4 reviews, 9 confirmed, 1 rejected, 31.0 avg minutes
- single-agent: 4 reviews, 5 confirmed, 3 rejected, 22.5 avg minutes
- forgeflow: 4 reviews, 5 confirmed, 1 rejected, 18.3 avg minutes

Context efficiency:
- estimated saved tokens: 46200
- percent saved: 61.4%
- budget violations: 0
```

Safe to share:

- aggregate records and rates
- workflow comparison rows
- context savings totals
- public-safe notes from `--public`

Do not share:

- raw `review-outcomes.jsonl`
- per-change titles if private
- individual reviewer comments with code references

## Generate A Public Summary

```bash
scripts/forgeflow/render-evaluation-report.js \
  --outcomes .forgeflow/<project>/review-outcomes.jsonl \
  --context-root .forgeflow \
  --budget-config .forgeflow-budget.json \
  --public \
  --out .forgeflow/<project>/evaluation-summary.md
```

Before sharing, read the generated file once and remove any project-specific text you added manually.
