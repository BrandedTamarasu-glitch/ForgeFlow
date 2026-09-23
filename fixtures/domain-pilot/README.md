# Domain pilot preparation

F5.3 is complete: twelve real-project reviews and two independent verification passes finished. The [results](../../docs/domain-pilot-results.md) show no added-procedure benefit: the primary money defect appeared in 3/3 baseline versus 1/3 enhanced reviews, while CAD produced no defect claims in either arm. A separate concurrency finding appeared in 3/3 per arm. Physical acceptance remains pending. The [frozen protocol](protocol.json) retains its original preparation status; it is not the current execution status.


## Cases and boundaries

- **Money:** WarmLedger's [exact-money migration](https://github.com/BrandedTamarasu-glitch/WarmLedger/commit/5aadc772dffcd09a75499b30a537623387458a29), compared with parent `7f53480a7485a68428f5ed7b6d047808cfc248c9`. Scope includes representation, conversion, amount boundaries, missing versus zero and affected import/export/presentation. This case does not cover real recurrence or timestamp/DST behavior.
- **CAD:** the local Steam Controller generation-one stand and generation-two cradle. These are file-hashed snapshots with no Git history; they are not represented as published PRs. The known first-generation fit failure is supplied context, not a fresh discovery. Third-party reference geometry and raw project copies remain local; nothing is republished here.

The private source manifest pins 197 files across the two cases, including the money diff. Its canonical source-set digest is recorded in the protocol. Both original CAD manifests match all 26 listed files per generation. Independent copied inputs and fresh contexts are prepared for every review. Workflow files and prior ledger audit reports are excluded equally; ordinary project documentation, tests and CAD validation summaries remain available. Read boundaries are instructions, not operating-system isolation.

Both arms receive identical project inputs, task scope and generic review instructions. The enhanced arm alone receives its domain procedure. Order alternates across three paired repetitions. Reviewers may report no findings. All responses were collected before blinded claim verification; verified mechanisms were deduplicated before the arm mapping was opened. Existing known findings, domain findings, other discoveries, unsupported claims and unresolved observations remain separate. There is no exhaustive defect key, so this cannot establish total recall or overall accuracy.

## Completed preflight

| Check | Observation |
|---|---|
| Relevant, irrelevant, mixed and ambiguous routing | 12 cases pass; both procedures remain evaluation-only |
| Money fixture clean cases and seeded defects | Pass, including 17 amounts, 15 recurrence examples, 256 generated cases, 2,412 months, nine defective alternatives and locale/timezone/no-write checks |
| CAD fixture clean cases and seeded defects | Three clean configurations and 24 seeded failures pass; slicer/physical/overall acceptance stays pending |
| Actual selected money revision | 80 targeted tests pass |
| Actual money parent | 60 available targeted tests pass; the new migration tests do not exist at the parent |
| Four actual CAD exports | Binary STL and 3MF ordered triangle coordinates match within 0.0001 mm; maximum observed difference is approximately 0.0000005 mm |
| Actual preview artifacts | Export bounds match preview bounds within 0.001 mm; each HTML file embeds the supplied JSON through the project's template |
| CAD regeneration and mesh-kernel checks | Not rerun: numpy, trimesh and manifold3d are unavailable in this environment |
| Fresh slicing and physical fit | Not performed; supplied slicing summaries are historical observations only |

The initial CAD preflight compared rounded coordinate sets and failed at rounding boundaries. Before any review, it was corrected to compare corresponding triangle coordinates with a declared tolerance. This is a preflight oracle correction, not a discovered product defect. Bounds and HTML embedding do not prove complete preview geometry identity, topology, fit or retention. The money timezone check initially hit a sandbox child-process restriction and passed when rerun with host execution.

Reproduce checkout controls with:

```
node scripts/forgeflow/test-domain-pilot.js
node scripts/forgeflow/test-money-calendar-correctness.js
node scripts/forgeflow/test-cad-fabrication-acceptance.js
```

The real project inputs, exact per-review prompts, manifests and CAD probe are preserved in ignored local evidence. A different machine must obtain matching inputs to reproduce the same case boundaries; published fixture files alone do not contain the private CAD snapshot. Do not silently substitute a newer revision or rerun completed trials to resume. Prior source files remain untouched. These preflight checks alone do not establish model benefit or physical acceptance; the separate completed comparison is reported above.
