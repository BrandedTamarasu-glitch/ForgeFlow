# Review And Execution Evolution

Status: E1 contract and local corpus preparation and E2 immutable evidence complete; E3 implemented with broader acceptance open; E4 bounded functional preparation and E5 existing-evidence adoption assessment complete; E3 broader benefit remains experimental. The [portable roadmap](../../ROADMAP.md) tracks these phases as E1–E5; the separate [F6.1 final checks](../completion-workflow-qualification.md) are complete. This plan follows the existing [roadmap priorities](Roadmap.md) after Phase 6 or an explicit reprioritization. It does not replace work already underway or assign release dates.

## Purpose

Improve the quality and efficiency of ForgeFlow's established specialist workflow. Make consequential judgments traceable to exact evidence, let reviewers request missing context, and execute routine preparation without repeated reasoning turns.

ForgeFlow's existing PR history supplies successful cases, corrections, and workflow friction to learn from. Controlled comparisons test specific proposed changes against that practice. They are not a substitute for operational experience, and a PR count alone is not a verified count of tool runs.

[Jive](https://github.com/merijjeyn/jive/blob/a1644e0c4d6efacb1d7aa96d0695581b1219bbb2/DESIGN.md) separates a main planner from executable operations and bounded model decisions. Its useful patterns are explicit inputs and outputs, dependency scheduling, complete artifacts with compact previews, and returning uncertainty to the planner. ForgeFlow should adapt those patterns where they help while preserving independent specialist investigation.

## Scope And Existing Foundations

Reuse review routing, specialist packets, trust manifests, raw-proof requirements, context waves, the task store, and existing verification. The capability roadmap already includes review calibration, skill-on/off evaluation and real-project comparative results. Reuse those cases and conclusions rather than restarting completed work. Avoid parallel implementations of capabilities already present. Inspect the adjacent Baa-ton adapter's validation-to-tool-result provenance before defining an incompatible evidence format.

The first runtime scope is review preparation and review handoffs. Validation and release preparation are possible later consumers, not initial deliverables. No source-editing scheduler, automatic publication, new dashboard, or host conversation replacement is included.

Every new contract must have a named caller and compatible behavior in Claude Code and Codex. Keep implementation in shared helpers where practical; host adapters retain native dispatch and authorization. Unsupported host capabilities produce an explicit limitation.

## Phase 1: Pilot Cases And Decision Contracts

**Status:** Complete. [Frozen decision contract and local qualification](../review-decision-contract.md) record seven cases, answer separation, historical baseline limits and predeclared criteria. No candidate model trials or production defaults changed.

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

**Implementation checkpoint:** E2 passes 225/225 local test commands, 13 independent acceptance checks and 16 storage checks, with both installed maintained host preparation paths verified. The real-PR gate also passes seven evidence-flow observations on owned PR #33 and its 67 scoped checks. [Immutable review evidence](../review-evidence.md) documents exact references, complete retrieval, source freshness, interrupted inspection, bounded storage and explicit retention. This is local helper qualification; live client dispatch and performance remain unqualified.

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

**Implementation checkpoint:** Concrete assignments, pinned artifact requests, durable cumulative limits, retained responses and current synthesis are implemented in both maintained host paths. A bounded owned PR #33 walkthrough preserves four required responses, a source challenge and explicit exhausted/denied uncertainty. The [decision contract checkpoint](../review-decision-contract.md#e3-implementation-and-real-pr-checkpoint) records exact revisions and input limitations. A separate neutral PR follow-up supports PR-scoped independence and correct-lookalike handling. General quality and comparative overhead remain unqualified; E3 stays unchecked. The comparison was stopped and is not scheduled to resume. E4 depends on completed E2 and proceeds with bounded deterministic preparation checks.

## Phase 4: Deterministic Review Preparation

**Dependencies:** Phases 1 and 2; Phase 3 supplies the review-quality comparison before broader adoption. Relative effort: medium.

**Deliverables:**

- Wire one preparation operation into the ordinary review entrypoint: collect scope, build required packets, measure budgets, construct bounded waves when needed, and return ready inputs or named blockers.
- Compose `render-review-wave-prep.js`, `build-context-wave.js`, and existing budget checks. Start with fixed, validated dependencies and structured command arguments. Introduce a generic graph language only if later demonstrated requirements exceed this design.
- Run independent operations concurrently only when their inputs and output ownership permit it. Use separate artifact destinations, explicit limits, cancellation, and typed outcomes. Dependent work stops when required evidence fails; unrelated completed results remain available.
- Journal per-step identity, observed inputs, start, outcome, and artifacts through existing durable state. On interruption, reconcile unknown effects before continuing. Reuse completed work only when inputs, source freshness, and repeat-safety permit it.
- Keep source edits and agent dispatch with existing owners. Automatic retries do not follow merely from missing output or a nonzero exit. Jive's saved-graph replay reruns all nodes; it is not a model for exactly-once execution.

**Named consumer:** The existing review entrypoint, using existing status and task inspection to explain preparation results. An orphan helper without this integration does not complete the phase.

**Functional exit criteria:** One operation returns pinned ready packets when the complete selected coverage fits, or a named blocker when a prerequisite or measured budget prevents readiness. Required proof and reviewer coverage are preserved, and completed results survive interruption. Focused checks cover changed inputs, cancellation, unknown effects, concurrent ownership and safe reuse; one owned-PR walkthrough confirms the relevant behavior. Successful preparation at every reduced budget is not required. Measured reasoning-turn, latency and general cost benefit belong to Phase 5 qualification.

**Implementation checkpoint:** The existing preparation helper now composes explicit scope, selected-route packet compilation, configured budget checks and bounded wave verification. Both maintained review entrypoints consume exact parent/child references from its receipt and stop on named blockers. Durable task actions preserve completed results, reject changed inputs/source and block unreconciled effects without automatic retries. Focused runtime checks also verify cancellation after a completed step, actual concurrent callers with one effect, and a ready four-wave full-roster fixture covering 40 source files with exact reuse. The advisory interface remains available.

A bounded helper walkthrough on owned [PR #33](https://github.com/BrandedTamarasu-glitch/baa-ton-forge/pull/33), base `f9bb8700bab14ff31dd09059250e8eae7290bbf2` and submitted head `19fb7b220115fe392301ecb6179f7478c78cff83`, verifies the original 17-file tree unchanged. Small and full scopes return ready, all four required reviewers and focused assignments remain present, unchanged reuse returns the same run, and changed input is blocked. A 1,000-token cap blocks before building a child. At 12,000 tokens one child is retained, then its measured over-budget result blocks review without trimming proof. Four new preparation identities and zero model calls were used. These observations precede the final input-revalidation safeguard; changed runtime fingerprints prevent silently reusing those earlier receipts. The preparation interface consolidates four separate helper operations into one; no elapsed-time superiority is claimed because the original timing was unavailable after a corrected harness assertion. E4 is complete for bounded functional preparation under the corrected acceptance above. This scope correction follows the observations: the former successful-PR-split and measured-performance closure requirements are deferred to Phase 5, not reported as passed. The observed budget blocker is expected safe behavior. Successful splitting of this PR at the selected reduced cap and latency/decision benefit remain unmeasured; neither blocks functional closure. Existing ready split fixtures support the runtime path, while the owned PR supplies normal readiness, reuse and budget-blocking evidence. No additional validation is scheduled.

## Phase 5: Comparison, Selective Adoption, And Optional Decision Trials

**Dependencies:** Completed candidate phases and Phase 1 cases. Relative effort: small for adoption analysis; any model trial is separate and conditional.

**Assessment scope:** Complete the independent adoption decisions below from retained evidence. This is the bounded next action selected after the E4 acceptance correction. The prospective comparison protocol remains available for separately requested qualification; it is not a requirement to restart completed or stopped studies. No new tests, PR walkthroughs or model calls are part of this assessment.

**Deliverables:**

- Compare current and candidate behavior on fresh copies of the same frozen cases. Record model, effort, settings, budget, host, source revision, and available configuration. Counterbalance order and repeat matched cases; retain failed attempts.
- Grade correctness separately from process completion. Measure confirmed defects, missed defects, false positives, human correction time, preparation reasoning turns, repeated reads, elapsed execution time, and actual tokens/cost where available. PR creation-to-merge time does not measure agent runtime.
- Adopt successful changes independently. Keep a compatibility path to current behavior until host parity and recovery cases pass. Report observed differences and measurement limits; do not convert a small pilot into a general superiority claim.
- Only if repetitive semantic decisions are a measured cost, trial a provider-neutral bounded decision interface with explicit evidence, candidate mapping, an insufficient-evidence result, and escalation. Retain deterministic code for exact checks. Model confidence and response-schema validity do not prove correctness.

**Named consumers:** Existing review routing and evaluation reports. Optional decision trials feed a documented route decision; they do not automatically introduce Jev or change model defaults.

**Assessment exit criteria:** Every candidate receives an explicit scoped adoption, hold or deferral decision with evidence, host limits and a compatibility path. Functional adoption requires verified intended behavior and maintained-host support; claims of improved accuracy, lower overhead or cheaper model decisions require the original prospective comparison criteria. Missing benefit evidence results in a hold or deferral, not additional automatic validation. Completion of this assessment does not mean the prospective qualification gates passed.

### E5 adoption decisions (2026-10-01)

| Candidate | Decision | Evidence and boundary |
| --- | --- | --- |
| E2 immutable evidence | Retain the existing functional implementation in packet-backed reviews. | [Owned-PR evidence-flow acceptance](../review-evidence.md#real-pr-acceptance) verifies pinned bytes, complete retrieval, distinct concurrent runs and stale/interrupted handling. Maintained installed-host helpers work on both supported paths. No accuracy, throughput or live-client claim. |
| E3 focused questions and bounded follow-up | Retain the implemented bounded controls; hold broader quality/cost adoption as experimental. | [Retained PR responses and neutral follow-up](../review-decision-contract.md#e3-implementation-and-real-pr-checkpoint) support scoped behavior and explicit uncertainty. The stopped comparison has one matched pair, insufficient for its frozen qualification. No new universal challenge stage, larger cohort, changed model defaults or performance promotion follows. |
| E4 deterministic preparation | Retain the ordinary preparation entrypoint for its completed functional scope. | The Phase 4 checkpoint establishes ready-or-blocked preparation, exact references, unchanged roster/proof and safe recovery. Four helper operations become one operation; this establishes interface consolidation, not fewer model reasoning turns or lower latency. Reduced-budget PR split success remains optional qualification. |
| Nine capability procedures | Retain evaluation status; promote none. | The [existing readiness assessment](../capability-readiness.md) records mixed or inconclusive comparative results and known controls/coverage limits. At this assessment the catalog gates were unchanged; the subsequent E6 policy below adds conditional use without benefit promotion. |
| Optional model decision interface | Defer; add no provider dependency or decision runtime. | No retained measurement isolates repetitive semantic decision overhead or demonstrates total savings including retry, escalation and mistakes. The prerequisite for a trial is absent. |

The comparison's completed, interrupted and cancelled arms remain separate. A correct blocker does not become a false finding, an unresolved claim does not become verified, and interface consolidation is not recast as model benefit. The original PR base/head and qualification limits remain in their source reports. This assessment adds decisions, not trial observations.

**Host and compatibility decision:** Retain the shared helper path and existing native dispatch/authorization owners. Disposable installed-host snippets qualify the maintained CLI integration; live client dispatch, additional platforms and prompt-only independence are distinct limits. Preserve skip/thin/full/deep coverage and session-wide follow-up limits across prepared waves.

**Compatibility and rollback:** The original `build-context-pack.js`, `review-evidence-cli.js`, `check-context-budget.js` and wave helpers remain available; the preparation helper's advisory mode is unchanged. If preparation introduces a concrete regression, stop dispatch, inspect and reconcile pending actions, and preserve all retained evidence. Restore the previous host preparation sequence through those existing helpers, keeping exact immutable references and configured budget verification, and keep maintained/generated host instructions in agreement. Continue focused follow-up against its existing parent session; do not reset allowances or substitute mutable latest. Legacy `--no-context-pack` remains unenforced behavior and is not an equivalent rollback for evidence-backed review. No rollback or runtime change is performed by this assessment.

**Completion:** E5's bounded adoption assessment is complete. E3 broader adoption remains on hold; additional performance, split-budget, native-host or model-decision qualification is deferred unless a concrete need and separate authorization arise. No new test, PR case, model call, capability activation, release or experiment is scheduled.

## On-Demand Capability Authority (E6)

The task owner may pull one of the nine implemented procedures when it helps a concrete acceptance requirement. The existing selector now accepts a relevant assessment with reason, source evidence and `execution: {scope, prerequisites, budget}`. It reports `executable: true` only for a selected, phase-appropriate procedure with those bounds. Keywords or include overrides alone do not enable use; explicit exclusions and reassessment ceilings remain effective. Evaluation labels continue to describe comparative-benefit evidence.

Load only the needed canonical procedure, reuse the existing responsible agent and current evidence, and carry the same assessment through `--capability-input` into context construction. Existing task/tool permissions remain authoritative; eligibility does not execute tools, authorize new external actions or prove a check passed. No standalone model decision runtime or unconditional procedure activation is introduced.

**Functional acceptance:** Focused selector checks and both disposable managed-host checks pass. One source/context walkthrough on owned PR #33 preserves an assessed change-propagation decision and its budget in the responsible packet, with current immutable references and unchanged submitted source. The trace follows the original task/phase contract through acceptance selection, validation guidance and verification handoff; existing test evidence is reused. One context build, zero model calls and no application test rerun. E6 is complete for conditional use; historical comparison decisions remain unchanged.

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
