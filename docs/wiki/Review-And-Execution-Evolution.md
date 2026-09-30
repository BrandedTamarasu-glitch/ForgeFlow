# Review And Execution Evolution

Status: queued, not started. The [portable roadmap](../../ROADMAP.md) tracks these phases as E1–E5; F6.1 remains the current next action. This plan follows the existing [roadmap priorities](Roadmap.md) after Phase 6 or an explicit reprioritization. It does not replace work already underway or assign release dates.

## Purpose

Improve the quality and efficiency of ForgeFlow's established specialist workflow. Make consequential judgments traceable to exact evidence, let reviewers request missing context, and execute routine preparation without repeated reasoning turns.

ForgeFlow's existing PR history supplies successful cases, corrections, and workflow friction to learn from. Controlled comparisons test specific proposed changes against that practice. They are not a substitute for operational experience, and a PR count alone is not a verified count of tool runs.

[Jive](https://github.com/merijjeyn/jive/blob/a1644e0c4d6efacb1d7aa96d0695581b1219bbb2/DESIGN.md) separates a main planner from executable operations and bounded model decisions. Its useful patterns are explicit inputs and outputs, dependency scheduling, complete artifacts with compact previews, and returning uncertainty to the planner. ForgeFlow should adapt those patterns where they help while preserving independent specialist investigation.

## Scope And Existing Foundations

Reuse review routing, specialist packets, trust manifests, raw-proof requirements, context waves, the task store, and existing verification. The capability roadmap already includes review calibration, skill-on/off evaluation and real-project comparative results. Reuse those cases and conclusions rather than restarting completed work. Avoid parallel implementations of capabilities already present. Inspect the adjacent Baa-ton adapter's validation-to-tool-result provenance before defining an incompatible evidence format.

The first runtime scope is review preparation and review handoffs. Validation and release preparation are possible later consumers, not initial deliverables. No source-editing scheduler, automatic publication, new dashboard, or host conversation replacement is included.

Every new contract must have a named caller and compatible behavior in Claude Code and Codex. Keep implementation in shared helpers where practical; host adapters retain native dispatch and authorization. Unsupported host capabilities produce an explicit limitation.

## Phase 1: Pilot Cases And Decision Contracts

**Dependencies:** Existing work reaches a suitable stopping point and this phase is selected. Relative effort: small.

**Deliverables:**

- Select a small local set of historical cases: an unsupported assumption, a test that passed without exercising its intended condition, a successful complex review, a trivial change, and an interrupted workflow. Add correct lookalikes to detect unnecessary findings.
- Freeze the relevant starting code, task instructions, scope, and expected checks. Keep later fixes and answer material outside the reviewer's accessible inputs. Record the limits of historical reconstruction.
- Define a compact record for consequential claims: question, claim, observed facts, assumptions, evidence identity, coverage, missing evidence, and disconfirming check. Distinguish supported, contradicted, and unresolved judgments from runtime success or failure.
- Define before running the pilot which defects must be detected, which lookalikes must remain unflagged, and acceptable review-time and cost overhead. Missing measurements remain unknown.

**Named consumers:** Ordinary review dispatch and synthesis, plus the existing [skill comparison protocol](../skill-evaluation.md). The evaluator supports separate `skill-disabled`/`skill-enabled` trials alongside the original workflow comparison arms. Use that two-arm contract where the candidate is an added procedure; preserve its frozen metadata and actual/fixture/unknown distinctions. Assess any remaining runtime-variant recording gap before extending the evaluator. No new general comparison runner is required by this plan.

**Exit criteria:** Cases are reproducible, answer isolation is checked, current behavior is recorded, and each proposed field serves a real review decision. No production defaults change in this phase. Do not build a general evaluation platform before testing a useful change.

## Phase 2: Immutable Evidence And Focused Retrieval

**Dependencies:** Phase 1 contract. Relative effort: medium.

**Deliverables:**

- Extend packet construction to preserve the exact inputs and results for each review run with stable IDs, content hashes, and source identity. Keep `latest` as a convenience reference rather than the identity of evidence consumed by a decision.
- Return bounded previews with coverage, explicit omission markers, and a retrievable full artifact. Preserve neighboring context and raw-required proof; a generic excerpt must not silently remove decisive evidence.
- Record which artifact versions each consequential decision used. Preserve complete historical evidence while rejecting it as current proof after relevant source or artifact changes.
- Use task-store freshness and pending-action semantics. Bound disk growth through documented retention behavior that does not silently delete artifacts referenced by retained decisions.

**Named consumers:** Context-packet generation, specialist handoff, review synthesis, and existing task inspection. Main seams are `build-context-pack.js`, `build-context-wave.js`, and `task-store.js` under `scripts/forgeflow/`.

**Exit criteria:** Two concurrent runs cannot overwrite each other's evidence. A later packet build cannot change the inputs attributed to an earlier judgment. Missing, changed, stale, and excerpted evidence remain distinguishable. Focused retrieval can recover the full proof, and an interrupted run remains inspectable.

## Phase 3: Focused Specialist Assignments And Evidence Requests

**Dependencies:** Phases 1 and 2. Relative effort: medium.

**Deliverables:**

- Preserve specialist responsibilities while assigning concrete questions and expected evidence. Use the contract for consequential claims, not a mandatory ledger for every trivial observation.
- Add a bounded missing-evidence response that names the unresolved question, required caller/schema/file, and why it matters. The orchestrator checks scope, retrieves the requested evidence, and resumes the relevant reviewer. Never mark an unresolved claim supported because a request budget expired.
- Set explicit request and expansion budgets. Permit targeted follow-up rather than unlimited repository exploration or a blanket inability to inspect a decisive dependency.
- For selected risky claims, request an independent challenge before exposing peer conclusions. Ask what alternative explanation fits the observed facts and which test distinguishes it. Preserve contextual facts and user constraints; do not mistake a different role name for independent reasoning.
- Escalate a specific unresolved question to the relevant specialist. Preserve existing skip/thin/full/deep routing and required accessibility/security coverage. Do not reduce mandatory coverage merely because earlier reviewers agreed.

**Named consumers:** Existing review dispatch, specialist packet assembly, verification, and synthesis. Update maintained workflow sources and their generated host forms together. Recordkeeping and formatting remain deterministic where no judgment is needed.

**Exit criteria:** The pilot catches the targeted unsupported assumption without flagging the correct lookalikes. Missing-context cases trigger a bounded request; exhausted or denied requests stay unresolved. Independent challenges are not preconditioned by prior verdicts. Small-change overhead stays within the Phase 1 budget.

## Phase 4: Deterministic Review Preparation

**Dependencies:** Phases 1 and 2; Phase 3 supplies the review-quality comparison before broader adoption. Relative effort: medium.

**Deliverables:**

- Wire one preparation operation into the ordinary review entrypoint: collect scope, build required packets, measure budgets, construct bounded waves when needed, and return ready inputs or named blockers.
- Compose `render-review-wave-prep.js`, `build-context-wave.js`, and existing budget checks. Start with fixed, validated dependencies and structured command arguments. Introduce a generic graph language only if later demonstrated requirements exceed this design.
- Run independent operations concurrently only when their inputs and output ownership permit it. Use separate artifact destinations, explicit limits, cancellation, and typed outcomes. Dependent work stops when required evidence fails; unrelated completed results remain available.
- Journal per-step identity, observed inputs, start, outcome, and artifacts through existing durable state. On interruption, reconcile unknown effects before continuing. Reuse completed work only when inputs, source freshness, and repeat-safety permit it.
- Keep source edits and agent dispatch with existing owners. Automatic retries do not follow merely from missing output or a nonzero exit. Jive's saved-graph replay reruns all nodes; it is not a model for exactly-once execution.

**Named consumer:** The existing review entrypoint, using existing status and task inspection to explain preparation results. An orphan helper without this integration does not complete the phase.

**Exit criteria:** Small and over-budget scopes produce the correct ready packets without manual command stitching. Failed prerequisites name the first blocker. Tests cover changed inputs, cancellation, unknown effects, concurrent output ownership, and no duplicate effects on recovery. Preparation uses fewer reasoning turns or less elapsed time on measured cases without weakening evidence or review coverage.

## Phase 5: Comparison, Selective Adoption, And Optional Decision Trials

**Dependencies:** Completed candidate phases and Phase 1 cases. Relative effort: small for adoption analysis; any model trial is separate and conditional.

**Deliverables:**

- Compare current and candidate behavior on fresh copies of the same frozen cases. Record model, effort, settings, budget, host, source revision, and available configuration. Counterbalance order and repeat matched cases; retain failed attempts.
- Grade correctness separately from process completion. Measure confirmed defects, missed defects, false positives, human correction time, preparation reasoning turns, repeated reads, elapsed execution time, and actual tokens/cost where available. PR creation-to-merge time does not measure agent runtime.
- Adopt successful changes independently. Keep a compatibility path to current behavior until host parity and recovery cases pass. Report observed differences and measurement limits; do not convert a small pilot into a general superiority claim.
- Only if repetitive semantic decisions are a measured cost, trial a provider-neutral bounded decision interface with explicit evidence, candidate mapping, an insufficient-evidence result, and escalation. Retain deterministic code for exact checks. Model confidence and response-schema validity do not prove correctness.

**Named consumers:** Existing review routing and evaluation reports. Optional decision trials feed a documented route decision; they do not automatically introduce Jev or change model defaults.

**Exit criteria:** Predeclared correctness and overhead criteria pass on held-out cases, both supported hosts have validation evidence, and rollback behavior is documented. A cheaper decision route requires observed total benefit including retries, escalation, and mistakes. Otherwise it remains deferred.

## Coordination And Validation

Keep one owner for shared evidence and freshness contracts. Coordinate packet changes with reviewers before parallel edits; agree result shapes before executor integration. Native approval behavior and file ownership must not be weakened by batching. Check installed-runtime packaging when helpers or generated workflow definitions change.

Historical PRs and private evidence remain local. Any reusable public fixture must remove private source, identities, URLs, and answer-bearing metadata. Publishing a roadmap does not authorize exporting trial records or running paid comparisons.

Validation accompanies each implemented phase: focused contract and failure tests, relevant existing task/context/routing checks, then a real host walkthrough. Documentation and current runtime behavior must clearly distinguish queued, experimental, and adopted capabilities.

## Accessibility Checklist

- [ ] Status and uncertainty are explicit in text and structured output, not color alone.
- [ ] Evidence links have descriptive labels and work through keyboard navigation.
- [ ] Missing evidence, truncation, exhausted requests, and failed prerequisites explain the next useful action.
- [ ] A text alternative communicates dependencies without requiring a visual graph.
- [ ] UI-related review cases test semantic accuracy, accessible names, and applicable keyboard behavior.
- [ ] Existing accessibility review coverage survives routing and efficiency changes.

## Deferred Unless Evidence Changes

General graph-runtime replacement, removal of specialist review, eager execution during streamed plan generation, automatic source-edit scheduling, native conversation compaction changes, a new model-provider dependency, and a new benchmark dashboard remain outside this plan. Revisit them only with a measured problem and a smaller alternative comparison.
