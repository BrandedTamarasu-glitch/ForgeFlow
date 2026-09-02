# Forgeflow Research Divergence Benchmark Study

## Purpose

This study tests two claims independently:

1. On genuinely open-ended problems, Forgeflow research with deterministic divergence produces decisions that are more useful than normal research.
2. A prospective classifier, tested without an explicit `--diverge` override, can distinguish those problems from tasks where divergence would add cost without value. Current Forgeflow does not auto-route research, so this is not a measurement of current product routing.

The study is a benchmark, not a product claim. A passing pilot only establishes that the protocol and instrumentation work. Comparative claims require the full preregistered run and human evidence.

## Design

The benchmark contains 16 tasks. The eight development tasks are the existing evaluation scaffold and may be used to debug prompts, capture, and scoring. The eight holdout tasks remain unseen by the research and routing implementations until the workflow, rubric, gates, and analysis code are frozen.

Each set contains four open-ended tasks and four controls. The full study therefore has eight open-ended tasks and eight controls.

### Development set

| ID | Class | Expected route | Task and immutable constraint |
| --- | --- | --- | --- |
| `architecture-boundary` | Architecture | Diverge | Choose a service boundary for a growing monolith without adding a new operational dependency. The first experiment must be reversible. |
| `intermittent-timeout` | Reliability | Diverge | Investigate intermittent request timeouts when logs do not reveal a single failing component. Do not assume the database is the cause. |
| `credential-rotation` | Security | Diverge | Design a safer credential-rotation path for a service with long-lived workers. Existing credentials cannot be invalidated all at once. |
| `keyboard-workflow` | Accessibility/product | Diverge | Improve a complex keyboard workflow while preserving expert efficiency. Every operation must remain keyboard accessible. |
| `canonical-http-status` | Standards lookup | Abstain | A successfully authenticated client requests a resource that does not exist. Select the canonical HTTP status using standard HTTP semantics. |
| `known-root-cause-null` | Known root cause | Abstain | A null dereference is reproduced at a named line because an optional value is used without a guard. The stack trace and null input are verified; choose the direct repair. |
| `low-stakes-color` | Reversible choice | Abstain | Choose one of two equally accessible internal placeholder colors for a temporary prototype. Both meet the same contrast requirement. |
| `canonical-exit-code` | Platform convention | Abstain | A command completes successfully. Select its conventional process exit code using POSIX semantics. |

### Holdout set

The holdout text should be stored in an access-controlled study input or supplied by the study operator, not embedded in the runtime router or model context before the preregistered run.

| ID | Class | Expected route | Task and immutable constraint |
| --- | --- | --- | --- |
| `event-sync-boundary` | Architecture | Diverge | Choose event-driven or request-driven synchronization between an order service and an existing fulfillment module under uncertain growth. No new broker may be operated during the first experiment, and rollback must take less than one hour. |
| `profile-sensitive-growth` | Reliability | Diverge | Investigate process memory growth that disappears whenever a profiler is attached. Production traffic cannot be replayed outside the isolated test environment, and the first probe must add under 1% CPU overhead. |
| `tenant-blast-radius` | Security | Diverge | Design tenant isolation for a hosted job runner where simpler operations conflict with blast-radius reduction. Jobs require outbound network access, and a cross-tenant credential exposure is unacceptable. |
| `destructive-recovery` | Accessibility/product | Diverge | Design recovery from destructive bulk actions for keyboard, screen-reader, and mobile users. Recovery must not depend on hover, precise pointing, or remembering an opaque identifier. |
| `canonical-method-not-allowed` | Standards lookup | Abstain | A resource exists but does not support the requested HTTP method. Select the standard HTTP response status and required response-header behavior. |
| `known-root-cause-off-by-one` | Known root cause | Abstain | A failing pagination test proves the final record is omitted because the loop uses `< lastIndex` instead of `<= lastIndex`. Apply the direct repair without redesigning pagination. |
| `low-stakes-label-order` | Reversible choice | Abstain | Choose whether two equally understandable temporary internal labels appear alphabetically or in creation order. The choice is reversible and has no user-facing compatibility impact. |
| `documented-rename` | Mechanical migration | Abstain | A dependency's official migration guide says `oldOption` was renamed to `newOption` with identical semantics. Update the verified call site without reconsidering the dependency architecture. |

## Experiment A: Paired decision quality

Experiment A uses only the eight open-ended tasks.

For every task and iteration, run two isolated arms from identical repository state:

- Baseline: normal Forgeflow research.
- Treatment: Forgeflow research with deterministic divergence.

The target is five independent iterations per task and arm: 80 outputs and 40 paired comparisons. Before that run, execute a one-iteration development-set pilot: four tasks, two arms, eight outputs. The pilot verifies capture, blinding, cost accounting, failure handling, and rubric comprehension; it is excluded from effect estimates.

Randomize arm execution order within each pair. After capture, strip route names, agent identities, timestamps, model metadata, formatting signatures, and filenames. Randomly assign each output to A or B using a recorded study seed. Judges must not receive the arm mapping. Preserve the mapping separately until scoring is locked.

Each output receives five 0–5 scores defined in `fixtures/research-divergence-study/judge-rubric.json`: breadth, novelty, trap detection, actionability, and builder usefulness. Judges also record `A`, `B`, `tie`, or `neither` for the paired builder choice and identify any critical factual, security, or accessibility error.

At least one experienced human engineer scores every full-study pair. A judge model from a different model family may score the same blinded pairs. Human results govern promotion and publication claims; cross-model results measure directional agreement and may not substitute for human judgment. Twenty percent of pairs, sampled across classes, receive a second independent human score. Report weighted Cohen's kappa for forced choice and intraclass correlation for scalar scores, without using agreement as a promotion gate.

Primary quality metrics are the paired human mean delta for builder usefulness and the human forced-choice win rate, where the treatment's denominator is treatment wins plus baseline wins and ties count as half a win in a separately reported sensitivity result. Secondary metrics are paired deltas for breadth, novelty, trap detection, and actionability. Report medians, bootstrap 95% confidence intervals by task, and results by task class. Do not treat repeated runs of one task as independent tasks.

### Experiment A promotion gates

All gates must pass on the combined development-plus-holdout full run, and the direction of builder usefulness must be positive on the holdout alone:

- Mean human builder-usefulness delta is at least `+0.50` on the 0–5 scale.
- Treatment wins at least `60%` of decisive human comparisons; at least 20 pairs must be decisive.
- Mean human trap-detection delta is at least `+1.00`.
- Mean human actionability delta is no worse than `-0.25`.
- No task class has a builder-usefulness delta below `-0.50` or a critical safety/accessibility regression attributable to the treatment.
- Treatment execution failure rate is below `5%`.
- Treatment median latency and median estimated cost are each no more than `3x` baseline.
- The cross-model judge agrees with the direction of the aggregate builder-usefulness effect. Disagreement blocks a broad claim and triggers review; it does not override the human score.

## Experiment B: Routing without an override

Experiment B uses all 16 task prompts and tests a prospective classifier separately from output quality. Present each task without `--diverge`, without an expected-route label, and without language telling it to explore or abstain. The measured decision is whether the candidate classifier chooses the divergent route or the direct/default route. These results must not be described as current Forgeflow routing accuracy until an automatic router exists and is tested through the actual entry point.

Run the one-iteration pilot on the eight development tasks first. After freezing the router and analysis, run five independent iterations across all 16 tasks: 80 classifications. Randomize task order per iteration and prevent prior decisions from entering later context.

Report overall accuracy, open-task recall, control-task specificity, false-divergence rate on controls, false-abstention rate on open tasks, and per-class confusion counts. A response that says it abstained but still launches divergent branches counts as divergence. A timeout, malformed decision, or hidden fallback counts as incorrect and as an execution failure.

### Experiment B promotion gates

- Overall routing accuracy is at least `90%`.
- Open-task recall is at least `85%`.
- Control-task specificity is at least `90%`.
- False-divergence rate on controls is at most `10%`.
- No task is misrouted in more than two of five iterations.
- Routing execution failure rate is below `5%`.
- Correct abstentions avoid the declared divergent workflow topology; report the avoided topology, tokens, latency, and cost when available. Do not claim an exact nested-call saving when the runner cannot observe nested model turns reliably.

## Isolation, privacy, and operational boundaries

- Run each arm or routing decision in a fresh temporary worktree or equivalent isolated checkout at the same commit and configuration.
- Pin model names, model settings, Forgeflow version, task text, and immutable constraints before the full run. Record them in the study manifest.
- Do not let one arm, iteration, judge, or task see another output, score, route decision, or saved Forgeflow memory.
- Disable or redirect normal research state writes. Raw prompts, branch outputs, judgments, and arm mappings stay in the study artifact directory and are excluded from Forgeflow memory, indexes, telemetry, commits, and release packages.
- Redact secrets and personal or repository-private data before model calls. The benchmark tasks contain no production data.
- Record wall-clock latency, outer runner invocations, retries, declared workflow-agent topology, and input/output tokens. Record exact nested model-call counts only when the runner exposes them reliably; otherwise mark them unavailable. Record provider-reported or reproducibly calculated cost when the execution channel exposes it, with the pricing snapshot and currency. For subscription runners that expose tokens but no per-call price, record cost as unavailable and preregister a token ceiling instead of inventing a dollar estimate.
- Use the same model and settings for paired generation arms. Do not silently replace failed calls with another model. The cross-model restriction applies to judging, not generation.
- Permit at most one retry for a transient generation failure. Retain both attempts in the private audit artifact and count the pair as failed if the retry fails.

## Stopping and amendment rules

Stop the pilot and fix the harness before proceeding if any output is unblinded, any raw artifact enters Forgeflow state, token capture is missing, provider cost is available but not captured, more than one of eight generation outputs fails, a judge cannot apply the rubric, or the same supposedly isolated input produces evidence of cross-run context.

Stop the full run for investigation if cumulative spend reaches the preregistered budget ceiling, three consecutive provider failures occur, the generation model/version changes, repository state drifts, privacy isolation fails, or a critical security/accessibility error indicates the benchmark itself could cause harm. Resume only with the original pinned conditions. Otherwise terminate the run and label the partial evidence incomplete.

Do not stop early because interim results look favorable or unfavorable. Any change after the pilot to prompts, frames, router, rubric, gates, model settings, or analysis creates a new benchmark version and requires a fresh full run. Operational corrections that do not affect model or judge inputs must be logged.

## Evidence and reporting limitations

The tasks are synthetic and the sample contains only two examples per broad class. Five stochastic repetitions improve stability but do not turn task-level observations into broad population evidence. Human judges may share Forgeflow assumptions; model judges may favor familiar structure or verbosity. Blinding can be imperfect when divergent prose has recognizable structure. Provider nondeterminism, changing model versions, and token-price changes limit replication.

Report pilot, development, holdout, human, and model-judge evidence separately. Publish failures, ties, `neither` decisions, class regressions, latency, and cost alongside favorable metrics. Do not claim that divergence generally improves engineering decisions unless the preregistered human gates pass; do not claim production impact, causality beyond this paired protocol, or equivalence between Claude and Codex from this benchmark alone.
