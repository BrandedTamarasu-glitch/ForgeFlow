# Review Routing

ForgeFlow classifies changes before spawning review agents. Start with `/review` in Claude Code or `$forge-review` in Codex. The route determines specialist coverage; every review does not need the full team.

## Modes

| Mode | Use Case |
|---|---|
| skip-mode | No changed files, or documentation-only changes of at most 200 changed lines outside source paths. |
| thin-mode | Test-only changes, or at most two low-risk non-frontend files and 50 changed lines. |
| full-mode | Standard multi-agent review. |
| deep-mode | Auth, security, migrations, schemas, permissions, crypto, or broad high-risk changes. |

## Route Helper

```bash
scripts/forgeflow/explain-review-route.js --json
```

With explicit files:

```bash
scripts/forgeflow/explain-review-route.js --json --files changed-files.txt --lines 120
```

When callers precompute line counts, they can also pass source detail:

```bash
scripts/forgeflow/explain-review-route.js --json --files changed-files.txt --lines 120 --tracked-lines 90 --untracked-lines 30
```

The JSON includes `lines_changed`, `tracked_lines`, and `untracked_lines` so routing decisions can explain whether new untracked files affected the selected mode.

With calibration:

```bash
scripts/forgeflow/explain-review-route.js --json --calibration .forgeflow/<project>/calibration-summary.json
```

## Aegis Verification

High-risk or historically noisy findings can be sent through Aegis before they become blockers.

Aegis returns:

- `CONFIRMED`
- `REJECTED`
- `BLOCKED`

The goal is not to suppress specialists. The goal is to separate useful attention from final judgment.

## Local Context Before Review

Review mode can prepare bounded context before agents are spawned:

```bash
scripts/forgeflow/build-context-pack.js --json
scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json
scripts/forgeflow/advise-context.js --root .forgeflow --record --json
```

The generated reviewer packets give specialists a focused view of the change. The context advisor reports low-savings packets, budget violations, and trend deltas from previous runs so the workflow can trim context before spending tokens.

## Interpret The Result

High-risk non-test paths take precedence over documentation and small-change rules. A large documentation change can receive a full review. Explicit mode overrides and CI policy can change the route; read the helper's reasons rather than assuming a file extension guarantees a skip.

A routing skip is not an approval from specialists. Review history records the final workflow verdict for shipping; dashboard verdict events and triaged `review-outcomes.jsonl` records serve different purposes. Save real review evidence before recording verdicts, and record confirmed/rejected outcomes only after triage. Empty charts on a fresh installation are expected. See [Dashboard](Dashboard.md) and [Telemetry Readiness](Telemetry-Readiness.md).
