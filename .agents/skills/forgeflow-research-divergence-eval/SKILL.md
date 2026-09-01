---
name: forgeflow-research-divergence-eval
description: Preview or summarize local baseline-versus-divergent Forgeflow research evaluations without running models or the network.
---

# Forgeflow Research Divergence Eval

Run the built-in deterministic eight-task preview:

```bash
node scripts/forgeflow/render-research-divergence-eval.js [--json]
```

When the user supplies captured evidence, summarize it separately:

```bash
node scripts/forgeflow/render-research-divergence-eval-results.js --evidence <repository-relative-json> --root "$(git rev-parse --show-toplevel)" [--json]
```

Both helpers are read-only. Do not write files, initialize Forgeflow state, record telemetry or memory, invoke agents or models, install dependencies, or call the network. Reject evidence paths outside the repository. If a helper is missing, report that Forgeflow needs repair/update instead of recreating its logic.

The preview proves only the task-pack shape. A results summary does not prove the runs occurred, scores were independently or human validated, divergence is generally superior, or results transfer beyond the eight tasks. Keep baseline and divergent evidence distinct. Bound quality, cost, latency, and reliability claims to the supplied sample and disclose scorer provenance, failures, and limitations. Identify unsupported conclusions explicitly.
