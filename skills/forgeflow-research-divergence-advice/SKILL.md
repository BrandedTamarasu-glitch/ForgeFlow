---
name: forgeflow-research-divergence-advice
description: Recommend normal or divergent research without automatically running either route.
---

# Forgeflow Research Divergence Advice

Run the deterministic, read-only helper before deciding whether to offer divergence:

```bash
node scripts/forgeflow/render-research-divergence-advice.js --task "<user task>" [--json]
```

Present the recommendation as advice, never an automatic route. It invokes no models or agents and performs no writes, telemetry, state initialization, or network access. Preserve an explicit user `--diverge` request even when the advice recommends normal research.

The reported pilot tradeoff is exploratory development evidence, not proof of human-validated quality gains, holdout transfer, or a production routing policy.
