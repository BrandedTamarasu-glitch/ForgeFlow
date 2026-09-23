# ForgeFlow roadmap

Last updated: 2026-09-23

## Current focus

**Intelligent skill selection:** give the existing agents nine specialized procedures and automatically select the smallest useful combination for each task.

Implementation status: **Phases 0, 1 and 2, plus Phase 3 reporting complete**. Contracts, bounded selection, managed-host entry points, corrected atomicity guidance and compatible skill evaluation are implemented. Change propagation, visual acceptance, persistence recovery, review calibration, provider compatibility and web/native release qualification are implemented in the evaluation cohort; normal automatic execution awaits qualification. The other three procedures remain planned.

**Next item: F4.1 — Benchmark verification.** F3.4 reporting is complete: 35 responses completed and one usage-limit interruption remains unsuccessful across 36 scheduled slots. Baseline/full each repaired 6/6 defective tasks; no accuracy gain is established. The web contract ambiguity remains documented in [results and limits](docs/provider-release-pilot-results.md). All six implemented capabilities remain in evaluation; no production release or model benefit is claimed.

This file is the portable source of truth for scope, progress and the next action. It is product planning documentation, not a copy of local session records. A checked item means its acceptance criteria were verified; it does not imply the change has been released.

**Session checkpoint:** complete through F3.4 reporting; no trial process is running. F4.1 is next. See [current status and resumption steps](STATUS.md). Phase 1 was published through `cebf945`; the packaged release version is unchanged.

## Resume and update rules

1. Read this file and `AGENTS.md`. Check the current branch, working tree and recent commits before continuing; preserve unrelated work.
2. Confirm the checkout contains the latest shared roadmap and implementation commits. Resolve divergent edits before marking progress.
3. Select the next unchecked item whose dependencies are met. Use its stable ID in planning and progress notes.
4. Implement and validate the bounded item. Mark `[x]` only after its acceptance criteria pass. Keep partial or blocked work unchecked and explain what remains in Current focus.
5. Update this file alongside the implementation: date, checkbox, relevant validation summary, limitations and next action. Add a short entry to Completed work with repository-relative references and a commit reference when available. Do not invent a commit hash or test result.
6. Commit and push only when authorized by the user. Cross-device synchronization requires those Git steps; saving a local file alone does not synchronize another checkout.

Keep private data, machine-specific paths, raw logs, session identifiers, local workflow artifacts and review attribution out of this file. Record observable engineering results, not internal review conversations.

## Design commitments

- Automatically select all nine capabilities when relevant, including money/calendar and CAD. Users do not need to manually opt in or know skill names.
- Consider task intent, acceptance criteria, workflow phase, affected code and project context. Project name or keywords alone are insufficient.
- Load detailed procedures only after selection. Reassess when scope changes or new evidence appears; deduplicate work and bound repeated routing.
- Explain meaningful selections briefly. Respect explicit overrides and show any resulting validation gaps. Skill selection does not create new permission to publish, access credentials or mutate external systems.
- Reuse existing roles, task evidence, UI iteration, review calibration, shipping and installer mechanisms. Avoid another orchestration layer.
- Separate package correctness, measured agent benefit and real-world qualification. Mocked evidence cannot establish native, hardware or physical success.

## Capability inventory

| Capability | Typical activation | Phase |
|---|---|---|
| Change propagation | Shared concepts, schemas, branding or generated artifacts change | 1 |
| Visual acceptance | Layout, components, typography, themes or interaction change | 1 |
| Persistence recovery | Storage, journals, migrations or concurrent writes change | 2 |
| Review calibration | Review guidance changes or review quality needs evaluation | 0, 2 |
| Provider compatibility | External API/CLI adapters or response contracts change | 3 |
| Release qualification | Installed, packaged or publicly deployed behavior needs verification | 3 |
| Benchmark verification | Performance or hardware-offload claims are made | 4 |
| Money/calendar correctness | Currency representation, recurrence or date arithmetic changes | 5 |
| CAD/fabrication acceptance | Geometry, fit, clearances or physical retention changes | 5 |

A money migration can select propagation, recovery and money/calendar together. A spelling correction generally needs none. CAD digital validation can finish while physical acceptance remains explicitly unverified.

## Phase 0: foundation and review correctness

Dependencies: none.

- [x] **F0.1 — Capability contract and integration map.** Define identifiers, triggers/exclusions, inputs, ownership, bounded procedures, evidence, prerequisites, cleanup and fallback behavior. Identify canonical sources and host entry points. Acceptance: all nine capabilities have a defined home; no duplicate task store or orchestrator is introduced. Delivered in [the capability contract](docs/capability-contract.md); validation is recorded below.
- [x] **F0.2 — Automatic selection.** Integrate a small catalog into existing routing/context paths. Support pre-diff intent, structural signals, bounded inspection, mixed-domain selection, overrides and reassessment. Acceptance: relevant, irrelevant, ambiguous and scope-change fixtures exercise selection; dependency deduplication and lazy loading work; selecting a skill adds no confirmation prompt. Version 1 has no hard capability dependencies; selected IDs are unique. Ambiguity uses bounded workflow assessments, not user skill selection.
- [x] **F0.3 — Host packaging.** Wire Claude Code and Codex discovery, installation and generated definitions to canonical procedures. Acceptance: targeted drift, manifest and disposable-install checks pass; unsupported host behavior is documented. The shared selection guide and generated workflow references are delivered now; domain procedure bodies remain scheduled for later phases. Managed installs and discovery declarations are tested, not live client activation.
- [x] **F0.4 — Atomicity guidance correction.** Replace unconditional dismissal of atomicity concerns for individually repeatable writes with analysis of intermediate visibility, concurrency and recovery guarantees. Acceptance: unsafe intermediate-state and lost-update examples remain detectable; safe independent operations and correct atomic implementations are represented; generated counterparts match. Six synthetic schedules cover three violations and three valid cases; these are executable examples, not measured reviewer trials.
- [x] **F0.5 — Evaluation foundation.** Add synthetic fixture provenance and skill-on/off metadata using existing evaluation machinery. Acceptance: existing workflow comparison semantics remain compatible; frozen baselines and separate answer keys exist; fixture, actual-model and unobserved outcomes remain distinguishable.

Initial integration areas: `agents/`, `.codex/agent-canonical-map.json`, `.codex/agents/`, `.agents/skills/`, `forgeflow-patterns/`, `commands/` and `scripts/forgeflow/`. Confirm source/generated ownership before editing. Inspect `install-manifest.js`, installed inventory, generation helpers and current routing/context helpers before extending them.

## Phase 1: change propagation and visual acceptance

Dependencies: Phase 0.

- [x] **F1.1 — Change propagation.** Map sources to consumers, generated outputs and related sites; record generation commands and freshness evidence. Acceptance: seeded outdated favicon, guide and screenshot references are found; clean artifacts pass; a schema/import/export/backup fixture demonstrates nonvisual applicability. Cross-repository discovery does not silently authorize edits.
- [x] **F1.2 — Visual acceptance.** Extend existing UI iteration with surrounding-page context, neighboring components, long content, themes, loaded fonts, alignment and overflow. Acceptance: an unintended paired-card mismatch is detected across selected breakpoints while intentional asymmetry is accepted; accessibility checks accompany screenshots.
- [x] **F1.3 — Pilot.** Run bounded skill-on/off trials on synthetic branding and paired-layout cases. Acceptance: report observed completion, missed issues, false findings and overhead; document unknown results without claiming improvement.

## Phase 2: persistence recovery and review calibration

Dependencies: Phase 0; reuse Phase 1 consumer mapping.

- [x] **F2.1 — Persistence recovery.** Identify authoritative state and commit/publication/cleanup boundaries. Exercise interrupted saves, quota/removal failures, stale readers/writers and concurrent cleanup with synthetic data. Acceptance: deterministic schedules expose seeded lost updates and committed-data deletion; corrected variants preserve declared invariants after reload, including old/new schema cases.
- [x] **F2.2 — Review calibration.** Extend existing debate/evaluation procedures with real defects, clean counterexamples, severity and missed-defect scoring. Acceptance: answer keys stay outside model inputs; reports distinguish false findings from missed defects and fixture success from actual reviewer performance.
- [x] **F2.3 — Pilot.** Compare recovery and review behavior on frozen failure/clean cases. Acceptance: record observed results and user-visible recovery behavior; no real financial records are used.

## Phase 3: provider compatibility and release qualification

Dependencies: Phase 0, Phase 1 artifact evidence and Phase 2 recovery conventions.

- [x] **F3.1 — Provider compatibility.** Add sanitized versioned fixtures for drift, malformed/partial responses, timeout, cancellation, stale data and independent failures. Acceptance: a failed provider cannot corrupt healthy results; stale data has an explicit status; credentials are absent from fixtures and output.
- [x] **F3.2 — Web release qualification.** Verify served artifact identity, assets and key interactions after authorized deployment. Acceptance: a successful build serving an older public artifact is distinguishable from the intended deployment; local simulation is labeled separately from public verification.
- [x] **F3.3 — Native release qualification.** Exercise installed artifact, first run, restart, update and uninstall/rollback in disposable profiles. Acceptance: at least one available native environment is checked; build/mock, installed, actual-host and human evidence are separate; unavailable platforms remain unverified; owned resources are cleaned up.
- [x] **F3.4 — Pilot.** Evaluate provider and release procedures against failure and clean cases. Acceptance: report results, platform limits and actual packaged/public accessibility observations where available.

## Phase 4: benchmark verification

Dependencies: Phase 0 and Phase 3 environment-evidence conventions.

- [ ] **F4.1 — Benchmark procedure.** Record hypothesis, executing backend, exact command/build/hardware, baseline, warmup policy, repeated raw measurements and correctness. Acceptance: a wrong-backend fixture rejects the attribution; negative controls actually affect execution; throughput, latency, memory and power claims are kept distinct.
- [ ] **F4.2 — CPU pilot and hardware limits.** Produce a reproducible local CPU example and compare skill-on/off claim assessment. Acceptance: retain scoped results and raw-measurement instructions; unavailable accelerator measurements stay unverified. Package completion does not establish NPU performance.

## Phase 5: domain capabilities

Both capabilities use automatic task-based selection. They are included scope, not a manual opt-in backlog.

- [ ] **F5.1 — Money/calendar correctness.** After Phases 0 and 2, implement representation/rounding, conservation, recurrence anchoring, month-end/leap-year/year-boundary, supported-range, missing-data and no-write checks. Acceptance: reproducible synthetic cases catch cents/dollars, rounding and recurrence defects; legitimate configured policies pass; tested ranges and locale presentation are explicit.
- [ ] **F5.2 — CAD/fabrication acceptance.** After Phases 0 and 1, implement measured/assumed dimensions, units/tolerances/material assumptions, current-mesh previews, export/topology, slicing/plate and clearance checks. Acceptance: seeded unit/geometry/clearance failures are detected and generated artifacts match source; written fit-test instructions cover insertion, pickup, controls, retention and stability. Reuse Phase 4 measurement discipline for physical claims.
- [ ] **F5.3 — Domain pilots.** Evaluate relevant and irrelevant routing, failure detection and clean cases for both packs. Acceptance: software/slicer outcomes and physical observations have separate status; unperformed physical checks cannot be marked passed. A digital package may complete while real fit/retention remains pending.

## Phase 6: measured rollout and documentation

Dependencies: all packages above; hardware/physical/platform limitations may remain explicitly documented.

- [ ] **F6.1 — Controlled comparisons.** Consolidate paired trials with identical isolated baselines, fixed model/settings/budget and counterbalanced order; start with at least three repeats for bounded model pilots. Acceptance: criteria are frozen before observation; all scheduled outcomes are reported; measure verified completion, missed defects, false findings, observed correction time and available latency/cost. Small samples are identified as such.
- [ ] **F6.2 — Activation readiness.** Review each skill's actual benefit and regressions. Acceptance: no unexplained new false blocker or critical seeded regression; normal automatic activation is supported by observed benefit. Inconclusive skills are revised/retested or retained in the evaluation cohort, not quietly presented as proven.
- [ ] **F6.3 — Integration and documentation.** Complete discovery, examples, overrides and disable/update/rollback guidance. Acceptance: targeted checks and the local full suite pass, generated sources agree, and primary-host install/update/rollback is verified. No hosted CI workflow is added.
- [ ] **F6.4 — Release preparation.** Prepare an accurate summary of available capabilities and evidence limits; inspect outgoing content. Acceptance: no local session state, private fixture data or unsupported performance/platform claims are included. Publication remains a separately authorized action.

## Validation and execution policy

- Run targeted checks with each implementation item; run the local full suite at integration and repeat when material fixes warrant it.
- Use synthetic/disposable data and environments. A skill's selection does not authorize live destructive tests, authenticated provider calls or print submissions.
- Give one implementation owner the shared catalog, schema and installer edits; separate capability procedures/fixtures can proceed independently once their contracts stabilize.
- Money/calendar work can follow Phase 2 alongside Phases 3 and 4. CAD procedures can follow Phase 1, with measurement qualification following Phase 4. Pilot each capability incrementally.
- Accessibility includes readable text statuses, keyboard/focus behavior, 200% text zoom, 400% reflow where applicable, contrast, reduced motion and understandable errors/freshness. Charts need text/table equivalents; CAD instructions need written dimensions and orientations.
- Fixture provenance includes source revision, reuse/license assessment, derivation and expected behavior. Prefer newly authored synthetic examples; public source availability alone is not redistribution permission.
- Measure unnecessary activations as well as missed capabilities. Keep routing inspection and repeated reassessment bounded.

## Completed work

| Date | Item | Result and validation | Reference |
|---|---|---|---|
| 2026-09-22 | Roadmap established | Nine capabilities, automatic selection, phases and acceptance criteria documented. Implementation and benefit measurements remain pending. | This file |
| 2026-09-22 | F0.1 | Checked nine complete capability contracts and 13 resolving local links. Read-only manifest checks confirmed an existing flat pattern is included for both managed hosts. Routing/context/evidence/generation paths inspected; no runtime behavior changed. | `b765215`; [contract and integration map](docs/capability-contract.md) |
| 2026-09-22 | F0.2 | Selector, context-pack integration, context-wave, existing reviewer routing and installer-manifest tests passed. Covers mixed-domain/pre-diff intent, exclusions, overrides, bounded inspection/reassessment, lazy loading and invalid inputs. Planned procedures remain unavailable; no measured agent benefit claimed. | [Selector tests](scripts/forgeflow/test-select-capabilities.js), [context tests](scripts/forgeflow/test-build-context-pack.js) |
| 2026-09-22 | F0.3 | Disposable Claude/Codex installs resolve the shared guide from unrelated directories, run selection, update and restore exact prior files on rollback. Unchanged reinstall preserves recovery. Packaging, selector, manifest, installer, updater, command index, skill generation and agent-drift checks passed. New skill frontmatter validated with the repository YAML parser; the Python validator lacked PyYAML. | [Packaging tests](scripts/forgeflow/test-capability-packaging.js), [host support and limits](docs/capability-contract.md#host-entry-points-and-packaging) |
| 2026-09-22 | F0.4 | Six deterministic cases passed; eight affected generated definitions match canonical sources. Agent drift, stub generation and role-migration checks passed. Removed both blanket transaction requirements and idempotency-based dismissal rules from active guidance and debate prompts. Historical reports retain their results with a supersession notice. | [Cases and limits](fixtures/atomicity/README.md), [regression checks](scripts/forgeflow/test-atomicity-guidance.js) |
| 2026-09-22 | F0.5 | Legacy workflow evaluation, new skill evaluation, atomicity and installer-manifest checks passed. Six synthetic inputs and separate answer-key hashes are frozen; 48 counterbalanced slots remain unobserved. Skill comparisons retain failed/missing attempts, reject changed protocol metadata and separate actual/fixture results. No model calls were made. | [Protocol and limits](docs/skill-evaluation.md), [regression checks](scripts/forgeflow/test-skill-evaluation.js) |
| 2026-09-22 | F1.1 | Six stale/current text consumers and synthetic import/export/backup round trips passed, including supported old-format import, mixed-version loss, source invalidation and read-only external boundaries. Selector, context-pack, manifest and disposable Claude/Codex install/run/update/rollback checks passed. Procedure remains in the evaluation cohort; screenshot pixels and model consumer discovery are untested. | [Procedure](forgeflow-patterns/capability-change-propagation.md), [fixtures and limits](fixtures/change-propagation/README.md), [checks](scripts/forgeflow/test-change-propagation.js) |
| 2026-09-22 | F1.2 | 38 local Chromium 153 browser checks passed: seeded width/height mismatch detected, balanced and intentional asymmetry accepted across three widths, two themes and short/long content; keyboard, focus, contrast, reduced motion, CSS text enlargement and narrow reflow probes recorded beside screenshots. Representative captures inspected. TypeScript, selector, context, command-index, manifest and managed-host install/update/rollback checks passed. Used an existing browser override after the default binary was unavailable; model benefit and full accessibility compliance remain unverified. | [Procedure](forgeflow-patterns/capability-visual-acceptance.md), [fixture coverage and limits](fixtures/visual-acceptance/README.md), [browser tests](tests/visual-capabilities/acceptance.spec.ts) |
| 2026-09-22 | F1.3 | 32 fresh-context responses completed with four repeats per case/arm and counterbalanced order. Both arms correctly interpreted all branding/layout cases with zero missed or false findings; enabled prompts added 4,808 and 4,341 UTF-8 bytes. Token/cost/latency/correction time remain null. Pilot and legacy/skill evaluator checks passed. Equal ceiling results do not justify activation; both procedures remain in evaluation. | [Results and limits](docs/capability-pilot-results.md), [frozen protocol](fixtures/capability-pilot/protocol.json) |
| 2026-09-23 | F2.1 | Eleven deterministic schedules detect direct-write corruption, lost updates and committed-data deletion; corrected staging, conditional publication, protected cleanup, pinned readers, removal failure and old/new schema reload cases pass. Selector, context-pack, manifest, atomicity and disposable Claude/Codex install/update/rollback checks passed. The selector child-process check required running outside the sandbox after empty output. No real backend durability, application UI recovery or model benefit claimed. | [Procedure](forgeflow-patterns/capability-persistence-recovery.md), [fixtures and limits](fixtures/persistence-recovery/README.md), [checks](scripts/forgeflow/test-persistence-recovery.js) |
| 2026-09-23 | F2.2 | Six executable cases cover three defects and three clean controls. Synthetic adjudication checks separate misses, false findings, severity over/understatement, unresolved and failed/unobserved outcomes. Legacy/skill evaluation, atomicity, selector, context-pack, manifest and managed-host packaging checks passed; generated debate validator matches its source map. No actual reviewer performance claimed. | [Procedure](forgeflow-patterns/capability-review-calibration.md), [cases and limits](fixtures/review-calibration/README.md), [scorer checks](scripts/forgeflow/test-review-calibration.js) |
| 2026-09-23 | F2.3 | All 32 fresh-context responses passed frozen defective/clean recovery and review cases, with zero misses, false findings or severity errors. All 16 reload predictions matched executed single-threaded simulations. Enabled prompts added 5,228 / 4,900 UTF-8 bytes; tokens, cost, latency and correction time remain null. Pilot, calibration and legacy/skill evaluation checks passed. Equal ceiling results do not justify activation. | [Results and limits](docs/recovery-review-pilot-results.md), [frozen protocol](fixtures/recovery-review-pilot/protocol.json) |
| 2026-09-23 | Evaluation follow-up | Eighteen repository-repair trials completed across baseline/checklist/full arms. Each passed all eight frozen checks; no repair-accuracy gain. The intended clean control had an uncovered read race, so source edits are not false-positive counts. Post-freeze diagnostic: baseline/full 5 of 6, checklist 4 of 6; exploratory only. Frozen preparation/oracle checks passed and all fixed source boundaries were preserved. Conditional retests were not triggered. | [Results and methodology limits](docs/recovery-workbench-results.md), [protocol](fixtures/recovery-workbench/protocol.json) |
| 2026-09-23 | F3.1 | Ten versioned payload cases and controlled schedules passed for malformed/partial data, provider isolation, stale cache, timeout, cancellation before/after launch, superseded success/error responses and recovery. Normalized output excludes fake private sentinels. Selector, context-pack, manifest and disposable Claude/Codex install/update/rollback checks passed. No live provider, actual transport termination, UI or model-benefit claim. | [Procedure](forgeflow-patterns/capability-provider-compatibility.md), [fixtures and limits](fixtures/provider-compatibility/README.md), [checks](scripts/forgeflow/test-provider-compatibility.js) |
| 2026-09-23 | F3.2 | Ten local Chromium 153 browser checks passed: current builds at two widths; stale/mixed bytes, missing assets, HTML fallback, incorrect media type, redirect and API failure detected; bodyless 304 stays unverified. Separate HTTP probes and browser-consumed document/script/style hashes; keyboard, pointer, focus/status and overflow checks. Strict TypeScript, selector, context, manifest and disposable managed-host install/update/rollback passed. Default browser unavailable; used an existing executable outside the socket-restricted sandbox. No public deployment, returning-cache/service-worker lifecycle or model qualification. | [Procedure](forgeflow-patterns/capability-release-qualification.md), [fixtures and limits](fixtures/web-release/README.md), [browser checks](tests/web-release/qualification.spec.ts) |
| 2026-09-23 | F3.3 | Native C fixture compiled with warnings treated as errors and executed on Linux x86-64. Installed hashes and executing path checked; first-run/restart/update/migration, incompatible binary-only rollback, explicit snapshot recovery, malformed-state rejection, launch permissions, uninstall data retention and reinstall passed. Owned installation/profile cleanup passed. Selector and disposable managed-host install/update/rollback passed. Compiler required execution outside the sandbox. File-copy installer is simulated; production packaging, desktop/human checks and other operating systems remain unverified. | [Procedure](forgeflow-patterns/capability-release-qualification.md), [fixture and limits](fixtures/native-release/README.md), [native checks](tests/native-release/qualification.cjs) |
| 2026-09-23 | F3.4 preparation (incomplete) | Three candidate controls passed 29 checks; defective versions produced 21 expected failures. Four deliberate control mutations were detected. Candidate hashes, 36 isolated slots, corpus-wide order balance, missing/failed/duplicate record handling and fixture/actual scoring boundaries validated. One native oracle expectation corrected before trials. No independent control review or model trial has run; final freeze and execution remain pending. | [Candidate protocol and limits](fixtures/provider-release-pilot/README.md), [preparation checks](tests/provider-release-pilot/preparation.cjs) |

## Known limits and blockers

- Broader benefit qualification needs independently challenged controls and varied held-out tasks. A future demonstrated improvement should trigger retests of all four previously trialed capabilities, including the Phase 1 pair. F3.4 controls were independently challenged and frozen before the authorized trial execution; results establish no gain; all slots are accounted for, with one unsuccessful usage-limit interruption. The Phase 2 code-review pilot completed with no measured accuracy advantage; caller-visible recovery results were simulated objects, not application UI observations. The Phase 1 pilot inherited a fixed session configuration, but exact backend identity, sampling settings and token/cost/latency measurements were unavailable. Its supplied-evidence results do not qualify independent discovery or browser work. The atomicity example remains fixture-only. No measured agent benefit is claimed.
- Canonical procedures use flat pattern files because nested pattern delivery differs between managed hosts. Live client discovery after restart and real plugin activation remain unverified. The current Codex lean plugin does not expose the capability entry point; managed Codex installation does.
- Actual accelerator, additional operating-system and printed-part qualification depend on access to those environments. These limit claims, not the ability to implement synthetic fixtures and procedures.
- Selection uses bounded behavioral heuristics and reasoned workflow assessments, not unrestricted language understanding. Change propagation has deterministic reference/schema checks and a supplied-evidence model pilot, not measured discovery benefit. Visual acceptance has local Chromium fixture evidence, with no axe, screen-reader, custom-webfont or actual browser-zoom qualification. Persistence recovery has synthetic byte-store reload evidence, not real backend crash/durability or application UI qualification. Review calibration also has a small code-review pilot with equal outcomes; broader discovery and repair benefit remains unverified. Provider compatibility has fictional versioned payloads and controlled transport/timer schedules; live services and UI remain unverified. Web release qualification has ten local Chromium checks for served bytes and interaction outcomes; public delivery, returning caches and service workers remain unverified. Native release qualification has actual Linux CLI fixture launches and profile lifecycle checks with simulated file-copy installation; production packages, desktop accessibility, Windows and macOS remain unverified. The other three procedure implementations and all measured-benefit qualification remain future work. Phases 0 and 1 were pushed to main as source milestones; the packaged release version is unchanged.

### F3.4 completed report (2026-09-23)

Independent review preceded freeze: 40 control checks pass, 30 seeded failures and ten mutations are detected. Thirty-five trial responses completed; one was interrupted by the CLI usage limit and remains unsuccessful. All 36 slots are accounted for. Baseline/full each repair 6/6 defective tasks. Checklist repairs 4/6 under the frozen oracle, but both failures involve ambiguous 304/MIME precedence; all 12 web submissions pass a separate matching-MIME diagnostic. Preserve primary scores and the unsuccessful attempt. No improvement trigger or activation qualification. F3.4 reporting is complete; F4.1 follows. See [results and limits](docs/provider-release-pilot-results.md).
