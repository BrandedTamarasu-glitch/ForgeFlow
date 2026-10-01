# Capability release preparation

Updated 2026-09-30. **F6.4 source summary and outgoing-content preparation complete. Packaged release publication remains pending.** The packaged version is unchanged at 4.6.3. This document is prepared release content, not evidence that a new release exists or that activation is qualified.

## Prepared public summary

ForgeFlow implements nine specialized procedures and selects relevant ones from task intent, affected code and workflow phase. Managed Claude Code and Codex workflows include selection entry points, explicit includes/exclusions and bounded reassessment. All nine procedures remain in evaluation; selection returns `executable: false` for ordinary workflows. The lean Codex plugin does not expose the managed capability entry point.

| Procedure | Implemented scope | Evidence boundary |
| --- | --- | --- |
| Change propagation | Trace shared changes through consumers and generated artifacts | Limited real-project discovery signal; broad completion benefit unqualified |
| Visual acceptance | Check layout relationships, responsive behavior and accessible interaction | Browser reproductions on one redesign; full accessibility and broader benefit unqualified |
| Persistence recovery | Exercise interrupted writes, identity, retries, migration and concurrency | Complementary discoveries and completion failures; control and workflow gaps remain |
| Review calibration | Separate confirmed defects, missed defects, unsupported claims and severity | Supplied-claim dispositions tie; severity-key semantics and full workflow remain unqualified |
| Provider compatibility | Check response contracts, freshness and failure isolation | Synthetic pilot ties; varied real-provider and live qualification remain pending |
| Release qualification | Check served/installed artifact identity and lifecycle | Scoped browser/Linux fixture evidence; actual deployment and additional platforms unqualified |
| Benchmark verification | Check executing backend, effective controls and correctness | Real-project findings favor baseline; accelerator performance and general benefit unqualified |
| Money/calendar correctness | Check units, rounding, conservation and date policies | Real-source detection favors baseline on one mechanism; real recurrence/DST unqualified |
| CAD/fabrication acceptance | Check geometry, exports, clearance and dimension provenance | Digital evidence only; detection sensitivity, actual slicing and physical fit unqualified |

The [readiness assessment](capability-readiness.md) promotes none. Historical studies preserve mixed outcomes and unresolved claims rather than reporting pooled accuracy or a general efficiency gain. The historical automated actual-PR comparison verified baseline 6/6 versus added recovery 3/6, including two timeouts and an administrative interruption. Three successful corrections were measured. The later synthetic study was stopped, with [every planned slot accounted for](completion-v3-partial-results.md); it is incomplete and its reference gaps limit interpretation. The [focused PR #33 validation](pr33-validation.md) found no reproduced introduced defect in the reviewed paths, which does not establish procedure benefit.

[Integration verification](capability-integration.md) passes all 222 local test commands after the wiki discoverability correction. Twenty-four generated entry-point references and 28 Codex agent definitions agree with their maintained sources. Disposable Claude and Codex managed install/update/unchanged-reinstall/rollback checks pass. Operating documentation covers exclusions and restoration while preserving required acceptance checks. These checks qualify the evaluation cohort's source integration and packaging, not live client activation or a production deployment.

## Outgoing-content inspection

The checkpoint changes from the prior shared roadmap through completed integration were inspected by filename, specific content checks and manual review. No generated session directories, raw trial logs, private source archives, credentials, machine-specific working paths or review attribution are included in these changes. Local evidence stays excluded. Synthetic fixtures, public-source revision references, aggregate outcomes and reproducible validation helpers remain distinguishable from private trial inputs. Frozen historical scores and protocols are preserved.

The synthetic publication and migration cases are authored examples. The receipt candidate applies a patch to a locally supplied pinned upstream checkout; no complete upstream application archive is bundled. No root license file or package license field was present in that pinned source. Redistribution rights for upstream-derived material have not been established by this preparation and must be reviewed before including it in a release artifact. Public source availability is not a licensing determination.

The summary makes no general accuracy, speed, cost, accelerator, cross-platform, live-provider, public-deployment or physical-fit claim. Platform and workflow gaps remain explicit. The filename/content inspection is not a claim of exhaustive secret detection or legal clearance.

## Remaining packaged-release gates

- Choose and synchronize an authorized semver, changelog, tag and packaged metadata before publication. The current 4.6.3 metadata remains consistent; no version bump or tag was made for this preparation.
- Run the [release gate](wiki/Release-Gate.md) from a clean checkout with Node 24, starting with `npm ci --ignore-scripts`. The completed 222-command run used Linux and Node 26.10.0; it does not substitute for that declared Node 24 gate.
- Review upstream-derived fixture redistribution before packaging. Retain the known control gaps and evaluation-only status in any final notes.
- Verify live client restart/discovery, settings and required release smoke evidence, or record remaining limits accurately. Disposable installation is not live-host verification.
- Inspect the final staged and outgoing release content again, then publish only as part of a separately authorized release. Perform tag/artifact/install verification after publication; those outcomes are currently unobserved.

The [F6.1 final checks](completion-workflow-qualification.md) complete bounded clean-control, historical-settings and supported Codex lifecycle qualification without changing any promotion decision. F6.1–F6.4 are complete as measurement, readiness, evaluation-cohort integration and source-release preparation. E1 local case/contract preparation and E2 immutable evidence are complete; E3 is the next implementation item. The packaged-release gates above remain pending; no new model study is scheduled.
