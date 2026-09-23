# ForgeFlow development status

Last updated: 2026-09-23

F3.1 is complete. **Next: F3.2, web release qualification.** F3.2 has not started. [ROADMAP.md](ROADMAP.md) owns the full scope, acceptance criteria and completion checklist.

## Completed checkpoint

- F3.1: provider compatibility procedure, ten versioned payload fixtures and deterministic isolation/freshness/cancellation/timeout schedules passed. Selector, context, manifest and disposable managed-host installation/update/rollback checks passed. No live provider or model qualification.
- Revised evaluation: 18 actual repository trials, equal 8/8 acceptance results for baseline/checklist/full arms. The intended control had an uncovered read race; its edit counts cannot measure false positives. The separate diagnostic also found no full-procedure advantage over baseline. No broader retest triggered. See [results](docs/recovery-workbench-results.md).
- F2.3: 32 actual trials completed; both arms passed every recovery/review case, with zero missed defects, false findings or severity errors. All reload predictions matched simulated execution. No measured accuracy gain; larger enabled prompts. See [results and limits](docs/recovery-review-pilot-results.md).
- F2.2: review calibration procedure, installed post-review scorer and six executable cases passed. Misses, false findings, severity errors, unresolved claims and failed/unobserved records stay distinct. Debate instructions and the generated validator include the scoring rules. Its original validation was fixture-only; subsequent bounded model results are in F2.3.
- F2.1: persistence recovery procedure and 11 deterministic schedules passed, including seeded defects and corrected reloads. Selection, context-pack, atomicity, manifest and disposable managed-host install/update/rollback checks passed. Real backend durability, application UI recovery and model benefit remain unverified.
- `007b8af`: change propagation procedure, scoped freshness checker and synthetic schema/branding fixtures.
- `d0c5b68`: contextual visual acceptance and browser fixtures; 38 Chromium checks passed.
- `c99cd88`: 32 independent skill-enabled/disabled trials, frozen inputs and scoring checks. Both arms interpreted every supplied-evidence case correctly, with zero missed defects or false findings. Enabled prompts were larger; no measured benefit was established.

Five implemented capabilities remain in evaluation. The other four procedures remain planned. Exact pilot backend identity, token usage, cost, latency and correction time are unavailable. See [pilot results and limitations](docs/capability-pilot-results.md). This source milestone does not change the packaged release version or establish live client activation.

The pilot, legacy evaluation and skill evaluation checks passed. Implementation-specific validation and remaining accessibility/platform gaps are recorded in the roadmap. Raw responses and session evidence remain local; the published protocol, fixtures and aggregate results provide the portable checkpoint.

## Resume on another computer

1. Fetch `origin`, inspect the current branch and working tree, and preserve any local work. Update a clean `main` checkout with `git pull --ff-only origin main`; resolve any divergence before continuing. For a fresh checkout, clone the repository's default branch.
2. Read `AGENTS.md`, this file, and `ROADMAP.md`. Confirm the checkout includes the three implementation commits above and this status file.
3. Preserve all original and revised evaluation results. No improvement trigger was met; no further trials are in progress. Start **F3.2** by reading the release-qualification contract, current shipping checks and served-artifact identity paths.
4. Add web qualification evidence that distinguishes intended, built and actually served artifacts, verifies assets and key interactions, and detects stale deployment. Label local simulation separately from authorized public checks; do not deploy merely to obtain evidence.
5. Validate the item, update roadmap/status and commit locally. Push at explicitly requested milestones. Phase 1 was published through `cebf945`; subsequent work remains local until the next authorized push.

Do not rerun completed pilots merely to resume. If a future valid task-based comparison demonstrates benefit, retest all four previously trialed capabilities as requested. First strengthen independent control qualification and held-out task coverage. Broader discovery, repair and browser trials and activation qualification remain future roadmap work. No preview server is needed for this handoff.
