# Capability contract and integration map

Status: Phase 0 foundation implemented. Change propagation, visual acceptance, persistence recovery, review calibration, provider compatibility, release qualification and benchmark verification have evaluation-cohort procedures; the other two procedure bodies remain planned. Discovery declarations are checked; live client discovery after restart is not claimed. See [the roadmap](../ROADMAP.md).

## Contract version 1

A capability is a bounded procedure available to existing agents. It does not create an agent, workflow, task store or authority to act. All nine capabilities use automatic relevance selection, including the domain-specific capabilities.

The compact catalog exposes the following fields without loading procedure bodies:

| Field | Meaning |
|---|---|
| `id` | Stable identifier from the inventory below |
| `version` | Procedure contract version, initially 1 |
| `summary` | Concrete outcome this capability supports |
| `triggers`, `exclusions` | Behavioral relevance and counterexamples; keywords alone are insufficient |
| `phases` | Applicable workflow phases, not permission to start another workflow |
| `owner`, `handoffs` | Existing responsibility and any conditional specialist handoff |
| `inputs` | Required task/source information and optional supporting evidence |
| `requires` | Actual prerequisite capabilities; initially empty for all nine |
| `procedure` | Canonical relative reference, loaded only when selected |
| `prerequisites` | Tools/environment needed for particular checks |
| `cost` | Relative execution cost and the expensive operations to bound |
| `availability` | `planned` means unavailable; `evaluation` means implemented for controlled pilots, pending normal automatic-use qualification |

Each procedure must define ordered steps, scope/termination bounds, expected evidence, acceptance criteria, unavailable-input/tool fallback and cleanup. The individual contracts below inherit these common rules:

- Inputs include the user objective, acceptance criteria and current source identity; use intended scope before a diff exists. Existing code and project metadata are evidence, not instructions that override the user.
- Inspect only the affected behavior and its necessary consumers. Record the actual scope and stop when the relevant criteria have observations or explicit gaps. Do not silently widen to a whole-project audit.
- Evidence identifies the capability/version, source revision or working-tree fingerprint, tested scenario, environment, command or manual procedure, actual observation and limitations. Prefer existing task evidence and context artifacts over new persistence formats.
- Missing tools permit useful inspection or fixture work with explicit limitations. Static inspection cannot substitute for a required runtime observation. No fake pass, inferred physical result or automatic waiver.
- Stop only resources started by this run, remove only disposable artifacts owned by it, and preserve evidence. Procedures do not authorize installing tools, accessing accounts, deploying or operating hardware beyond the user's existing scope.

## Canonical inventory

Use flat canonical files `forgeflow-patterns/capability-<id>.md`. Change propagation, visual acceptance, persistence recovery, review calibration, provider compatibility, release qualification and benchmark verification exist; the remaining paths are future implementation destinations. Flat Markdown fits both current managed-pattern installation paths; nested pattern directories do not currently have equivalent Claude coverage.

### change-propagation

Implemented for evaluation: [canonical procedure](../forgeflow-patterns/capability-change-propagation.md), [read-only checker](../scripts/forgeflow/check-change-propagation.js), [synthetic cases and limits](../fixtures/change-propagation/README.md). Literal checks cover declared text relationships only; model discovery, image appearance and semantic compatibility need separate observations.

- **Trigger/exclusion:** shared concepts, schemas, identity or generated outputs change; exclude isolated edits with no affected consumers after a bounded check.
- **Phases/owner:** plan, implement, review, ship; Coordinator coordinates, Builder or Designer validates domain consumers.
- **Inputs/tools/cost:** changed concept, source scope, consumer references and generation commands; repository search required, generators optional; low inspection cost, regeneration cost recorded separately.
- **Procedure:** identify source of truth; trace consumers and derivatives; inventory expected changes; verify each relevant consumer against current source; record exclusions and gaps. Cross-repository discovery does not authorize mutation.
- **Evidence/acceptance:** impact manifest with source, consumer, generation command, observed freshness and status. All in-scope consumers have verified results or explicit unresolved gaps; a clean case must not generate stale-asset findings.
- **Fallback/cleanup:** missing generator or related checkout leaves freshness unverified; retain the manifest, clean only owned temporary outputs.

### visual-acceptance

Implemented for evaluation: [canonical procedure](../forgeflow-patterns/capability-visual-acceptance.md), contextual acceptance in [UI iteration](../commands/ui-iterate.md), and [local browser fixtures](../fixtures/visual-acceptance/README.md). Required failures are excluded from cosmetic ranking. Chromium fixture observations do not establish model benefit, full accessibility compliance or live application qualification.

- **Trigger/exclusion:** layout, typography, theme, component or interaction change; exclude nonvisual edits and intentional asymmetry that satisfies the brief.
- **Phases/owner:** implement, review, ship; Designer executes, Product Lead checks user acceptance.
- **Inputs/tools/cost:** affected UI, intended relationships and representative states; browser automation when available; medium, bounded viewport/theme/state matrix.
- **Procedure:** inspect full-page context; check neighboring geometry, long content, loaded fonts and overflow; exercise keyboard/focus, zoom/reflow, contrast and reduced motion; compare intended relationships rather than universal pixel equality.
- **Evidence/acceptance:** contextual screenshots, measurements and interaction observations tied to source; seeded mismatch fails and corrected layout passes; accessibility gaps remain visible.
- **Fallback/cleanup:** source inspection without a browser is partial evidence; stop owned browser/server sessions and preserve captures.

### persistence-recovery

Implemented for evaluation: [canonical procedure](../forgeflow-patterns/capability-persistence-recovery.md) and [synthetic recovery schedules](../fixtures/persistence-recovery/README.md). Deterministic reload/interleaving checks do not establish actual backend durability or model benefit.

- **Trigger/exclusion:** save, migration, journal, cleanup or concurrency behavior changes; exclude read-only presentation changes without persistence effects.
- **Phases/owner:** plan, implement, review; Builder executes, Guardian assesses boundaries, Verifier handles serious disputed findings.
- **Inputs/tools/cost:** authoritative-state definition, commit boundaries, synthetic old/new data and executable harness; medium/high, bounded deterministic fault schedules.
- **Procedure:** map publication and reclamation; inject interruption, quota/removal failure and stale reader/writer schedules; reload; inspect surviving authoritative data and invariants.
- **Evidence/acceptance:** reproducible schedule, before/after state and actual reload result; seeded corruption is detected and repaired variants satisfy declared invariants. Repeatability alone does not establish atomicity.
- **Fallback/cleanup:** without a harness, provide a concrete unexecuted schedule; never use live user data; remove disposable stores after evidence capture.

### review-calibration

Implemented for evaluation: [procedure](../forgeflow-patterns/capability-review-calibration.md), [post-review scorer](../scripts/forgeflow/score-review-calibration.js) and [executable cases](../fixtures/review-calibration/README.md). Adjudication remains evidence-based work; synthetic scorer checks are not actual reviewer observations.

- **Trigger/exclusion:** review-rule changes or explicit quality evaluation; exclude ordinary application changes with no need to calibrate reviewer behavior.
- **Phases/owner:** research, implement, review; Architect scopes the exercise, Verifier checks claims, Product Lead assesses outcomes.
- **Inputs/tools/cost:** frozen defective and clean examples, separate answer keys, model/settings/budget and rubric; existing debate/evaluation tools; high for actual model trials, bounded repeat count.
- **Procedure:** freeze cases and rubric; hide answer keys from evaluated agents; run paired trials; compare observed claims to justified outcomes; report missed defects, false findings and severity errors.
- **Evidence/acceptance:** complete trial records including failed/unobserved trials; deterministic fixture success and measured reviewer benefit are separate; no selective reporting.
- **Fallback/cleanup:** without model execution, deliver fixture readiness only; preserve local results and dispose of isolated trial copies.

### provider-compatibility

Implemented for evaluation: [canonical procedure](../forgeflow-patterns/capability-provider-compatibility.md) and [versioned synthetic fixtures](../fixtures/provider-compatibility/README.md). Deterministic transport/timer observations do not establish live provider compatibility, transport termination or model benefit.

- **Trigger/exclusion:** external API/CLI parsing, protocol or freshness behavior changes; exclude unrelated UI copy and internal-only logic without provider effects.
- **Phases/owner:** implement, review, ship; Builder executes, Guardian checks credentials/failure isolation; Designer handles affected user states.
- **Inputs/tools/cost:** supported versions, sanitized contract fixtures, normalization and freshness rules; fixture harness required for runtime checks, live credentials optional; medium.
- **Procedure:** exercise valid, changed, malformed and partial responses; timeout/cancel; isolate provider failures; inspect freshness and redaction.
- **Evidence/acceptance:** version/scenario matrix and observations; failed providers do not corrupt healthy results and stale values cannot appear fresh.
- **Fallback/cleanup:** fixture-only results do not establish live compatibility; authenticated smoke checks require existing authority; close owned clients and scrub temporary sensitive output.

### release-qualification

Web and native branches implemented for evaluation: [canonical procedure](../forgeflow-patterns/capability-release-qualification.md) and [controlled served-artifact/browser cases](../fixtures/web-release/README.md). The [native fixture](../fixtures/native-release/README.md) adds compiled Linux process and profile lifecycle checks with a simulated installer. These fixtures do not establish production/public qualification, graphical accessibility or model benefit.

- **Trigger/exclusion:** packaged, installed or published behavior needs verification; exclude source-only edits without a release-qualification objective.
- **Phases/owner:** plan, review, ship; Product Lead coordinates, Designer checks interaction/accessibility and Guardian checks environment boundaries.
- **Inputs/tools/cost:** artifact identity, target environment/URL, lifecycle expectations and available authority; HTTP/browser or native harness; medium/high, explicit platform matrix.
- **Procedure:** choose web/native branch; verify actual artifact identity; exercise key interactions; native branch checks first run, restart, update and rollback/uninstall in disposable profiles; record cleanup.
- **Evidence/acceptance:** distinguish build/mock, installed, real-host, public and human results; stale public artifacts and failed native lifecycle checks remain failures; unsupported platforms remain unverified.
- **Fallback/cleanup:** no target environment means a prepared checklist, not qualification; never deploy merely to obtain evidence; restore owned disposable environment and stop owned processes.

### benchmark-verification

Implemented for evaluation: [canonical procedure](../forgeflow-patterns/capability-benchmark-verification.md) and [synthetic execution controls](../fixtures/benchmark-verification/README.md). Deterministic timings and in-process backend counters qualify only the fixture. The [CPU example and real-project comparison](benchmark-cpu-pilot.md) are complete: baseline found more verified issues on the selected changes. Actual accelerator performance and broader benefit remain unverified.

- **Trigger/exclusion:** optimization or hardware performance claims; exclude unrelated changes and unsupported intuition that is not being evaluated as a claim.
- **Phases/owner:** research, implement, review; Builder executes, Verifier checks attribution and Product Lead bounds claims.
- **Inputs/tools/cost:** hypothesis, correctness oracle, baseline, exact builds/commands/hardware; benchmark harness and actual claimed hardware where relevant; high, capped repetitions and warmup policy.
- **Procedure:** attest executing backend; establish a working negative control; verify correctness; repeat baseline/treatment runs; separate latency, throughput, memory and power.
- **Evidence/acceptance:** raw measurements and scoped conclusions; wrong-backend attribution fails even with favorable performance; omitted metrics remain unknown.
- **Fallback/cleanup:** CPU or simulated results cannot qualify an unavailable accelerator; stop owned workloads and restore only settings changed by the experiment.

### money-calendar-correctness

- **Trigger/exclusion:** currency representation, rounding, recurrence or calendar arithmetic; exclude spelling edits in financial applications and display-only changes without semantic effects.
- **Phases/owner:** plan, implement, review; Builder executes, Product Lead defines product policies, Guardian checks persistence interactions.
- **Inputs/tools/cost:** unit/rounding/date/timezone policies, supported ranges and synthetic examples; deterministic test harness; medium, bounded generated cases with saved seeds.
- **Procedure:** derive conservation/conversion and no-write properties; exercise month-end, leap-year and year-boundary recurrence; test bounds and missing-data provenance; distinguish locale presentation from stored values.
- **Evidence/acceptance:** seed, range and failing/passing examples; cents/dollars and recurrence defects fail while valid configured policies pass.
- **Fallback/cleanup:** missing business policy is a substantive clarification, not an invitation to invent rounding rules; use no real ledgers; remove disposable stores.

### cad-fabrication-acceptance

- **Trigger/exclusion:** physical geometry, fit, clearance or retention requirements; exclude anvil-logo illustration work with no physical model and unrelated CAD documentation edits.
- **Phases/owner:** plan, implement, review; Designer and Builder develop digital checks, Product Lead defines physical acceptance.
- **Inputs/tools/cost:** measured/assumed dimensions, units, tolerances/material and geometry source; mesh/export/slicer tools as available; medium digital cost, separate physical resource cost.
- **Procedure:** verify units/topology/export/source agreement; inspect plate and clearance; prepare insertion, pickup, control-access, retention and stability checks; separate digital, slicer and physical observations.
- **Evidence/acceptance:** dimensions and assumptions, current mesh evidence and written physical procedure; seeded geometric errors fail; digital validity cannot clear physical fit criteria.
- **Fallback/cleanup:** missing printer/object leaves physical checks pending without blocking truthful digital results; do not submit print jobs automatically; preserve evidence and clean owned temporary exports.

## Selection and evidence boundary for F0.2

Inputs are task intent/criteria, workflow phase, changed or intended scope, current project facts and explicit overrides. Structural signals shortlist candidates; semantic relevance decides selection. Inspect a bounded amount of context for ambiguity, then record a reason for selecting, skipping or deferring. Selection and ability to execute are separate: a relevant CAD capability may have unverified physical steps.

No hard inter-capability dependencies exist in version 1. Combining capabilities means sharing useful inputs, not automatically launching a chain. Phase dependencies in the roadmap are implementation sequencing, not runtime dependencies. Overrides cannot silently erase required acceptance checks or grant new permissions. Reevaluate on meaningful new evidence with deduplication and a bounded reassessment count, not on every tool call.

Store routing explanations in the existing context/task flow. Do not add capability names to existing reviewer ID lists or reinterpret review modes. Missing or unknown capability versions must produce an explicit unavailable result; they cannot fall through as success.

Existing task evidence accepts `test`, `manual`, `review` kinds and `passed`, `failed`, `waived` statuses. Unperformed capability checks must remain missing acceptance evidence with a limitation, not a new invented status or automatic waiver. A criterion's source freshness still applies. Record measured versus simulated provenance in the attached artifact; keep trial results in existing evaluation records. Preserve compatibility before proposing schema extensions.

## Integration map: observed code and intended changes

| Existing location | Observed responsibility | Integration decision |
|---|---|---|
| [explain-review-route.js](../scripts/forgeflow/explain-review-route.js) | `classify` chooses review mode and reviewer routing from file/change signals | Preserve mode/reviewer semantics; expose capability selection separately in F0.2 |
| [build-context-pack.js](../scripts/forgeflow/build-context-pack.js) | Calls `classify`, builds file/diff context and role packets | Primary insertion point for selected references and rationale; retain context budgets and trust boundaries |
| [build-project-intelligence.js](../scripts/forgeflow/build-project-intelligence.js) | Aggregates project knowledge and next-work suggestions | Reuse available advisory project facts; do not require its full pipeline or treat old memory as authority |
| [advise-context.js](../scripts/forgeflow/advise-context.js) | Existing context advice | Keep existing budget/advice flow; inspect lazy-load overhead there |
| [task.js](../scripts/forgeflow/task.js) and [task-store.js](../scripts/forgeflow/task-store.js) | Checks, evidence, checkpoints and freshness | Reuse task IDs and evidence artifacts; no capability task store |
| [task-evaluation.js](../scripts/forgeflow/task-evaluation.js) | Fixed workflow arms and actual/fixture/unobserved comparison records | Separate [skill comparisons](skill-evaluation.md) retain frozen schedules and provenance without changing existing arm meanings |
| [install-manifest.js](../scripts/forgeflow/install-manifest.js) | Source filtering, destination mapping and generated installed inventory | Flat pattern Markdown and the shared selection guide are delivered on both managed paths; isolated install/update/rollback tests cover the entry points |
| [generate-codex-agent-stubs.js](../scripts/forgeflow/generate-codex-agent-stubs.js) | Generates from canonical map/source | Update canonical definitions then regenerate; avoid independent TOML prose edits |
| [render-forgeflow-skills.js](../scripts/forgeflow/render-forgeflow-skills.js) | Generates five workflow wrappers | Not a generic capability catalog; extend intentionally only where discovery requires it |
| [Claude plugin](../.claude-plugin/plugin.json) and [Codex plugin](../.codex-plugin/plugin.json) | Different plugin component declarations | Claude declares the new wrapper; the current Codex lean plugin does not expose it. Neither declaration establishes live client discovery |

Canonical procedures will use flat `forgeflow-patterns/capability-<id>.md`. The compact [catalog](../scripts/forgeflow/capability-catalog.js) contains only metadata and relative references. The pure [selector](../scripts/forgeflow/select-capabilities.js) is called by existing context construction and is also available through a JSON CLI for workflows without diffs. It does not spawn agents, read procedure bodies, access networks or mutate task state.

Codex entry points belong under `.agents/skills/`; Claude entry points use existing command/agent references. These wrappers should delegate to canonical procedures, not copy their bodies. Agent selection and skill selection remain independent. Canonical maps and drift checks must cover any changed agent definitions.

The Claude manifest recognizes flat pattern Markdown; Codex source filtering also accepts nested patterns. Version 1 uses flat files. `installed-codex-inventory.json` is generated by installer machinery and is not a maintained source file in this checkout. Packaging tests inspect that generated inventory. The Codex plugin declares a different skills root from managed Codex installation; it remains a lean-only path for this feature.

## Acceptance and next implementation boundary

F0.1 completes when the nine identifiers, homes, inherited and specific contract fields, evidence mapping and integration decisions above are checked against current source. This document does not establish automatic activation or installation success.

F0.2 implements selection and its relevant/irrelevant/ambiguous/mixed-domain/scope-change tests. F0.3 verifies managed packaging and discovery declarations. F0.4 corrects canonical review and debate guidance, backed by [six executable atomicity examples](../fixtures/atomicity/README.md) and synchronized Codex definitions. Procedure implementation and model-benefit evidence follow their roadmap phases; deterministic examples do not establish measured review improvement.

## Selector usage and limits

For a quick pre-diff selection:

```bash
node scripts/forgeflow/select-capabilities.js --task 'Fix recurring budget calculations'
```

For explicit criteria, phase, overrides or a reasoned assessment, supply JSON:

```json
{
  "task": "Fix partial responses in the job-source adapter",
  "phase": "implement",
  "files": ["src/providers/jobs.js"],
  "criteria": ["A failed provider must not hide healthy results"],
  "assessments": [{
    "id": "provider-compatibility",
    "relevance": "relevant",
    "reason": "The changed normalizer handles partial external responses.",
    "evidence": "src/providers/jobs.js:12"
  }],
  "overrides": {"include": [], "exclude": []}
}
```

Run `node scripts/forgeflow/select-capabilities.js --input <file>` or pass the same file to `build-context-pack.js --capability-input <file>`. The context builder uses its explicit `--task` when supplied; otherwise it uses the JSON task for selection. Without explicit JSON files, selection uses up to 200 changed paths and reports any omitted count. Explicit `files` means caller-supplied intended scope and is labeled as such, not claimed to cover all changed files. Task input is capped at 12,000 characters; at most 30 criteria of 1,000 characters each and nine reasoned assessments are accepted. Oversized or malformed explicit inputs fail clearly.

The initial selector uses conservative behavioral patterns to shortlist/select clear task requests. It is not a general natural-language model: negation, nuanced requirements and unfamiliar terminology may need a workflow assessment. File names or a domain noun alone request inspection, not activation. Agents inspect relevant source within the budget and return `relevant`, `irrelevant` or `uncertain` with reason and evidence; users do not need to choose a skill. A workflow assessment is advisory and cannot grant authority or mark a procedure executed. Catalog phase applicability is checked before explicit include/exclude overrides; a conflicting include and exclude is rejected rather than resolved silently. Unknown IDs/versions fail explicitly.

The output includes one decision per capability, selected IDs, up to three inspection requests and the scope fingerprint. Pass the previous result as `previous` after meaningful discoveries. An unchanged normalized scope consumes no reassessment; changed scope allows three reassessments before further selections are deferred with unresolved gaps. A new independent task starts a new budget. Preserve the previous result to keep the bound effective; do not reset it to work around a deferred result.

The context builder writes `capability-selection.json` beside existing context artifacts, links it from synthesis input and appends scoped guidance to existing role packets. Reviewer lists/modes and task evidence are unchanged. No procedure body is loaded; change propagation, visual acceptance, persistence recovery, review calibration, provider compatibility, release qualification and benchmark verification have `availability: evaluation`, the other two have `availability: planned`, and all have `executable: false` in normal routing pending qualification. This proves selection plumbing, not capability execution or measured agent benefit.

## Host entry points and packaging

The [shared selection guide](../forgeflow-patterns/capability-selection.md) contains the canonical workflow procedure. `node <helper-dir>/select-capabilities.js --guide` resolves that guide relative to the running helper, so an installed copy works outside the ForgeFlow checkout. `--stdin` accepts bounded JSON without writing task state, supporting read-only workflows. Isolated research lanes retain their existing context boundaries.

The [entry-point generator](../scripts/forgeflow/render-capability-entrypoints.js) maintains references in nine Claude workflow commands and twelve Codex workflow skills, including aliases. It also generates the direct `/forgeflow-capabilities` command and the two host skill wrappers. These references make selection part of the existing workflow; users do not need to invoke a new command to opt in. Aliases and context rebuilding reuse results and reassessment state.

| Installation path | Checked support | Remaining limit |
|---|---|---|
| Source checkout | Selector, shared guide, generated command/skill entry points | Host UI discovery requires loading/restarting the client |
| Managed Claude installation | Command, discovery skill, workflow references, runtime helpers and flat guide; disposable update/rollback | No live Claude session was launched to prove UI discovery |
| Managed Codex installation | Discovery skill, workflow references, installed inventory, runtime helpers and guide; disposable update/rollback | No live Codex session was restarted to prove UI discovery |
| Claude plugin | Declared command/skill roots contain generated entry points; guide resolves from bundle source | Real plugin installation/activation remains unverified |
| Current Codex lean plugin | Existing lean behavior retained | Its `.openclaw/skills/` surface does not expose this capability entry point; use the managed Codex installation |
| Other hosts/adapters | No additional parity claim | No new capability discovery integration in this item |

The nine domain procedure paths remain future implementation destinations. Packaging installs the selection guide and catalog now; it does not create empty procedures or mark them qualified.

For source maintenance, run `node scripts/forgeflow/render-capability-entrypoints.js --write` after changing generated entry-point guidance; run without `--write` to detect drift. The generator preserves content outside its marked blocks. It is a source-checkout maintenance command, not an installed-runtime repair command. Keep the usual agent canonical-map checks when agent definitions change.

Validation: `test-capability-packaging.js` covers generated drift/repair, managed discovery files, invocation from an unrelated directory, stdin without project writes, missing-guide errors, generated Codex inventory, update, unchanged reinstall and exact rollback restoration in disposable homes. Existing manifest, template, updater and agent-drift checks remain applicable. These tests do not measure agent benefit or establish live host/plugin discovery.
