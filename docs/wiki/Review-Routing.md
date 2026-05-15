# Review Routing

Forgeflow classifies changes before spawning review agents.

## Modes

| Mode | Use Case |
|---|---|
| skip-mode | Docs-only or no meaningful code surface. |
| thin-mode | Small, low-risk, or test-only changes. |
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
