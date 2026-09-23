# ForgeFlow development status

Last updated: 2026-09-22

Work stopped after completing Phase 1. **Next: F2.1, persistence recovery.** No Phase 2 implementation is in progress. [ROADMAP.md](ROADMAP.md) owns the full scope, acceptance criteria and completion checklist.

## Completed checkpoint

- `007b8af`: change propagation procedure, scoped freshness checker and synthetic schema/branding fixtures.
- `d0c5b68`: contextual visual acceptance and browser fixtures; 38 Chromium checks passed.
- `c99cd88`: 32 independent skill-enabled/disabled trials, frozen inputs and scoring checks. Both arms interpreted every supplied-evidence case correctly, with zero missed defects or false findings. Enabled prompts were larger; no measured benefit was established.

Both implemented capabilities remain in evaluation. The other seven procedures remain planned. Exact pilot backend identity, token usage, cost, latency and correction time are unavailable. See [pilot results and limitations](docs/capability-pilot-results.md). This source milestone does not change the packaged release version or establish live client activation.

The pilot, legacy evaluation and skill evaluation checks passed. Implementation-specific validation and remaining accessibility/platform gaps are recorded in the roadmap. Raw responses and session evidence remain local; the published protocol, fixtures and aggregate results provide the portable checkpoint.

## Resume on another computer

1. Fetch `origin`, inspect the current branch and working tree, and preserve any local work. Update a clean `main` checkout with `git pull --ff-only origin main`; resolve any divergence before continuing. For a fresh checkout, clone the repository's default branch.
2. Read `AGENTS.md`, this file, and `ROADMAP.md`. Confirm the checkout includes the three implementation commits above and this status file.
3. Start **F2.1** by inspecting `docs/capability-contract.md`, `scripts/forgeflow/capability-catalog.js`, `scripts/forgeflow/task-store.js`, `fixtures/atomicity/` and the Phase 1 procedures. Reuse existing storage and evaluation mechanisms.
4. Map authoritative state and commit/publication/cleanup boundaries. Implement a bounded recovery procedure and synthetic schedules for interrupted saves, quota/removal failures, stale readers/writers and concurrent cleanup. Detect seeded lost updates and committed-data deletion; verify corrected invariants after reload for old/new schemas.
5. Validate F2.1, update the roadmap and this status file, and commit the completed item. Continue the existing cadence of local item commits and explicitly requested milestone pushes.

Do not rerun the Phase 1 pilot merely to resume. Broader discovery, repair and browser trials and activation qualification remain future roadmap work. No preview server is needed for this handoff.
