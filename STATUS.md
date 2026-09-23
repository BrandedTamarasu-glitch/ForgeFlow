# ForgeFlow development status

Last updated: 2026-09-23

F2.1 is complete. **Next: F2.2, review calibration.** F2.2 has not started. [ROADMAP.md](ROADMAP.md) owns the full scope, acceptance criteria and completion checklist.

## Completed checkpoint

- F2.1: persistence recovery procedure and 11 deterministic schedules passed, including seeded defects and corrected reloads. Selection, context-pack, atomicity, manifest and disposable managed-host install/update/rollback checks passed. Real backend durability, application UI recovery and model benefit remain unverified.
- `007b8af`: change propagation procedure, scoped freshness checker and synthetic schema/branding fixtures.
- `d0c5b68`: contextual visual acceptance and browser fixtures; 38 Chromium checks passed.
- `c99cd88`: 32 independent skill-enabled/disabled trials, frozen inputs and scoring checks. Both arms interpreted every supplied-evidence case correctly, with zero missed defects or false findings. Enabled prompts were larger; no measured benefit was established.

Three implemented capabilities remain in evaluation. The other six procedures remain planned. Exact pilot backend identity, token usage, cost, latency and correction time are unavailable. See [pilot results and limitations](docs/capability-pilot-results.md). This source milestone does not change the packaged release version or establish live client activation.

The pilot, legacy evaluation and skill evaluation checks passed. Implementation-specific validation and remaining accessibility/platform gaps are recorded in the roadmap. Raw responses and session evidence remain local; the published protocol, fixtures and aggregate results provide the portable checkpoint.

## Resume on another computer

1. Fetch `origin`, inspect the current branch and working tree, and preserve any local work. Update a clean `main` checkout with `git pull --ff-only origin main`; resolve any divergence before continuing. For a fresh checkout, clone the repository's default branch.
2. Read `AGENTS.md`, this file, and `ROADMAP.md`. Confirm the checkout includes the three implementation commits above and this status file.
3. Start **F2.2** by reading the review-calibration contract in `docs/capability-contract.md`, the existing debate procedures, `scripts/forgeflow/task-evaluation.js` and the atomicity/recovery fixtures. Preserve existing workflow comparison semantics.
4. Add bounded review-calibration guidance with real defects, clean counterexamples, severity and missed-defect scoring. Keep answer keys outside model inputs and distinguish deterministic fixture evidence from actual reviewer performance. F2.3 owns the subsequent pilot.
5. Validate the item, update the roadmap and this status file, and commit locally. Push at explicitly requested milestones. Phase 1 was published through `cebf945`; F2.1 is the subsequent local checkpoint.

Do not rerun the Phase 1 pilot merely to resume. Broader discovery, repair and browser trials and activation qualification remain future roadmap work. No preview server is needed for this handoff.
