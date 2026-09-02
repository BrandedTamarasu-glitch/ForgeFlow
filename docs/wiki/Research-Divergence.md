# Research Divergence

Forgeflow automatically routes focused research tasks to normal research or divergent research. The automatic decision is deterministic, local, and always visible before work begins.

## Using it

```text
/research choose a service boundary under uncertain growth
/research --no-diverge investigate a verified root cause
/research --diverge compare several consequential architecture approaches
/forgeflow-research-divergence-advice <task>
```

- A focused `/research <task>` uses automatic routing.
- `--no-diverge` forces normal research.
- `--diverge` forces the isolated divergent route.
- `/forgeflow-research-divergence-advice <task>` previews the recommendation without invoking research.
- An unfocused `/research` invocation uses normal research because there is no task text to classify.

## What divergence changes

Divergent research generates isolated alternatives through fixed frames, then uses a separate critic and independent codebase evidence lane to converge on a recommendation. The route is read-only: it does not initialize Forgeflow state, add project memory, emit telemetry, or save raw divergent outputs.

Normal research remains the route for canonical answers, verified root causes, mechanical changes, and low-stakes reversible choices.

## Evidence and boundaries

The routing policy was evaluated with paired normal-versus-divergent research tasks, holdout tasks, routing controls, and blinded human scoring. The evaluation supports automatic routing as an overrideable convenience, not an irreversible product decision.

Automatic routing reports the chosen route and its rationale. It does not prevent either override, infer permissions, write user settings, or make claims about a task beyond the supplied text. Treat the displayed latency and token figures as observed benchmark tradeoffs, not a guarantee for every project or provider.
