# PRISM-Inspired Forgeflow Routing Notes

Source analysis: `/home/user/Downloads/PRISM-vs-Forgeflow-analysis.md`

## Core Takeaway

Persona agents are useful for attention and review discipline, but they can hurt exact reasoning when the persona lens overrides code evidence. Forgeflow should treat specialist personas as recall tools and force their claims through routing, evidence, synthesis, and validation before action.

Operational rule:

> Use persona for attention. Use evidence and neutral verification for judgment.

## What Already Matches PRISM

Forgeflow already has workflow-level analogues for selective persona activation:

- `/review` routes by diff shape: skip, thin, full, deep.
- Agents receive bounded file context and file-scope constraints.
- Specialist findings require concrete evidence and fixes.
- Arbiter synthesizes, deduplicates, and rejects weak or unconfirmed findings.
- Compass performs final requirements, UX, accessibility, and validation checks.
- Telemetry records verdicts, auto-fix events, and overturned findings.

This is a prompt/workflow analogue of PRISM's model-level gate.

## Recommended Improvements

### 1. Telemetry-Informed Routing

Use existing telemetry to tune which agents run:

- High false-positive rate for an agent/class should trigger stricter pre-checks.
- Repeated real findings in a path/class should expand routing triggers.
- Atlas should stay out of thin mode unless feature/spec breadth warrants it.
- Lumen should route into backend diffs when service-boundary or client-path evidence suggests UX/connectivity risk.

Initial implementation can be heuristic and explainable. It does not need model training.

### 2. Per-Agent Confidence Calibration

Use Arbiter's overturned findings plus review history to derive trust by agent and finding class:

```text
warden/sql-injection: confirmed 2, overturned 0 -> high trust
fc/missing-transaction: confirmed 1, overturned 5 -> require idempotency proof
lumen/accessibility: confirmed 4, overturned 0 -> high trust
atlas/questions: dropped 3 -> suppress similar thin-mode questions
```

This makes the system learn where a persona helps instead of assuming every specialist lens is always useful.

### 3. Neutral Base-Verifier Pass

For high-risk findings, add a non-persona verifier before surfacing a blocker:

- security
- auth/session/permissions
- migration/schema/data loss
- critical correctness
- broad refactor regressions

Verifier prompt shape:

```text
You are a Aegis. No persona. Confirm or reject this finding from visible evidence only.
Return: CONFIRMED, REJECTED, or BLOCKED.
Required evidence: attacker-controlled input, call path, state mutation, failing invariant, or exact schema/data-loss path.
```

This approximates PRISM's base-model fallback after persona recall.

### 4. Explainable Routing Records

Every review should record:

- selected mode
- rule that fired
- files that triggered the rule
- agents included and skipped
- cost/coverage tradeoff
- telemetry hints that supported or contradicted the route

The route should be auditable like findings are.

### 5. Split Attention From Verdict

Long-term design:

1. Specialist persona generates candidate concerns.
2. Neutral verifier checks candidates.
3. Arbiter synthesizes only verified or explicitly blocked claims.

That keeps the useful part of personas, while reducing persona-driven overconfidence.

### 6. Real PR Evaluation

To compare Forgeflow quality empirically:

- Collect a corpus of real PRs.
- Compare no Forgeflow, single-agent review, full Forgeflow, and full Forgeflow plus auto-fix.
- Measure confirmed defects found, false positives, review time, token cost, maintainer agreement, and post-merge regressions.
- Stratify by docs, tests, frontend, backend, auth, migrations, and broad refactors.

## Codex Port Implications

The Codex model retiering now matches this direction:

- Leaf specialists use cheaper subagent models where possible.
- Final synthesis and validation remain stronger.
- Code-writing agents stay on Codex coding models.
- Drift checks keep thin Codex agents tied to canonical persona prompts.

Codex Sprint 1 adds:

- `.codex/agents/aegis.toml`
- `.agents/skills/aegis-verify/SKILL.md`
- high-risk verifier routing guidance in `.agents/skills/forgeflow-review/SKILL.md`

Codex Sprint 2 adds:

- `scripts/forgeflow/explain-review-route.js`
- route fixtures under `fixtures/review-route/`
- routing note requirements in `.agents/skills/forgeflow-review/SKILL.md`

Codex Sprint 3 adds:

- `scripts/forgeflow/summarize-calibration.js`
- additive telemetry event `finding-verified`
- fixture coverage for overturned findings, verifier decisions, and auto-fix outcomes

Codex Sprint 4 adds:

- optional `--calibration <summary.json>` input for `explain-review-route.js`
- `telemetry_hints` that expose high-value, noisy, or insufficient-history classes
- conservative verifier escalation for historically noisy classes
- Lumen expansion for thin-mode service-boundary diffs when UX/connectivity history supports it

The routing remains heuristic and auditable. Calibration can explain or tighten a route, but low-count history is surfaced without changing agent selection.

Codex Sprint 5 starts outcome evaluation:

- `docs/forgeflow-evaluation-protocol.md`
- `scripts/forgeflow/record-review-outcome.js`
- local JSONL records for mode, agents, verifier decisions, accepted/rejected findings, review time, auto-fix outcome, and regression signal

This gives Forgeflow a small empirical loop before claiming quality, latency, or false-positive improvements.

Codex Sprint 6 starts prompt parity generation:

- `scripts/forgeflow/generate-codex-agent-stubs.js`
- optional source-map fields for selected canonical sections and manually curated summaries
- fixture coverage proving a small canonical prompt can generate a parseable Codex TOML stub

The goal is drift assistance, not automatic persona expansion. Generated stubs still need human review before replacing curated Codex agents.
