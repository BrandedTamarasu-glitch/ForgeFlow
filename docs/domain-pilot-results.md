# Domain capability pilot results

Date: 2026-09-23. **Complete: 12/12 real-project reviews and two independent verification passes. No added-procedure benefit was observed.** The money procedure found the same representation defect less consistently than baseline. CAD reviews tied with no reported defects and preserved the distinction between digital evidence and physical acceptance. Both procedures remain in evaluation.

## Cases and method

| Case | Frozen inputs | Added procedure |
|---|---|---|
| Money | [WarmLedger exact-money migration](https://github.com/BrandedTamarasu-glitch/WarmLedger/commit/5aadc772dffcd09a75499b30a537623387458a29), parent `7f53480a7485a68428f5ed7b6d047808cfc248c9` | Money/calendar correctness |
| CAD | File-hashed local generation-one controller stand and generation-two cradle snapshots; no Git history or PR claim | CAD/fabrication acceptance |

These were actual project changes with independent discovery, not supplied-claim questions. The money case covers amount representation, migration and consumers; it does not qualify real recurrence or timestamp/DST behavior. The CAD case includes real source, STL/3MF exports, previews and existing reports. Its known first-generation physical failure is context, not a new discovery. Two underlying cases and three repetitions per arm remain a small exploratory sample.

The [protocol](../fixtures/domain-pilot/protocol.json) and prompts were frozen before reviews. Its authorization status describes the preparation checkpoint; this report records the completed authorized run. Twelve fresh contexts inherited the session model without an override, with two concurrent reviews per pair and alternating arm order. Both arms had separate copies of identical inputs and the same generic review instructions; only enhanced received the domain procedure. Previous ledger audit reports and workflow files were excluded equally. Review source files were unchanged; probes stayed in assigned disposable directories.

All twelve outputs were collected before ten money claims were anonymized and independently verified. CAD produced no claims, so its separate verification pass checked anonymized observations for unjustified digital, slicer or physical assertions. Claim dispositions and the CAD boundary report were hashed before opening the arm mapping. Producing review histories were not supplied to verification; independent probes corroborate results without attesting to every review's claimed execution.

## Results

Counts are reviews reporting a verified mechanism, out of three per arm. Repeated occurrences are not additional distinct bugs.

| Verified finding or outcome | Baseline | Enhanced |
|---|---:|---:|
| Money: recovery leaves stale resident schema, selecting the wrong persisted/export representation | 3/3 | 1/3 |
| Money: new migration overwrites a newer second-store edit, a separate storage-concurrency finding | 3/3 | 3/3 |
| CAD: reported introduced defect claims | 0/3 | 0/3 |
| CAD: reviews improperly claiming fresh slicing or physical acceptance | 0/3 | 0/3 |

Under the frozen domain scope, the **primary money result is three versus one verified occurrences of the same single mechanism**. Per-repetition counts were baseline `[1, 1, 1]`, enhanced `[0, 1, 0]`. The generic concurrency finding is reported separately: three occurrences per arm, one mechanism each. Including that finding gives six baseline versus four enhanced occurrences across the same two distinct mechanisms. All ten reported claims were confirmed within their stated scope; none was classified unsupported or unresolved. There is no exhaustive defect inventory, so these counts cannot establish total recall or overall accuracy.

CAD's zero-claim result does not establish a defect-free design or a sensitive defect-detection test. Both arms already received common instructions against fabricated physical observations and had well-documented digital/physical limitations. This measures incremental value beyond those shared rules. The result supplies no discovery or evidence-boundary advantage for the added CAD procedure.

## What was independently verified

**Recovery representation mismatch:** three parseable but invalid schema-4 inputs enter recovery. `startFresh` writes a schema-3 ledger, but head retains resident version 4, reports migration already complete and exports schema 4. The next ordinary edit writes schema 4 without the explicit migration promised by the product. Base stays at schema 3. Invalid schema-3 input, syntactically invalid JSON and a reload after reset are clean controls. These are one state-synchronization mechanism, not separate bugs for each symptom. No monetary value corruption was reproduced; the demonstrated impact is representation/status inconsistency and bypassed migration policy. The probe exercised the actual Store API and serialized output, not a browser click-through.

**New migration's stale overwrite:** two actual Store instances share the supplied in-memory storage adapter. After the first previews migration, the second changes savings from 400 to 499.99, 777 or 401. Confirming the first preview succeeds, writes 40000 cents and snapshots the stale value, losing the newer edit. The migration action and its stated freshness guarantee are new; ordinary stale writes also reproduce in base and are not counted as a newly introduced generic storage flaw. Same-instance stale previews are rejected without writes. Valid migration preserves values, null and zero; 0.29 becomes 29 cents; sub-cent values are rejected without implicit rounding; snapshot and primary-write failures preserve active bytes. This is a two-instance reproduction, not two browser windows or proof of an atomic storage solution.

**CAD evidence boundaries:** standard-library probes independently reproduced finite coordinates, nondegenerate/unique faces, paired edge incidence and winding, connectedness and positive volume for the four print meshes in both STL and 3MF. Export and printable preview coordinates agree within their declared precision; HTML matches template substitution. The head reference transform and analytic plate/brim envelope also reproduce. These checks do not establish general self-intersection freedom, strength, minimum wall thickness, physical clearance or printability. The original CAD kernel, Boolean collision/support/retention checks and slicer were not rerun. All six reviews acknowledged those limits and left physical tests pending.

## Historical context and limitations

The earlier published ForgeFlow evaluation mechanisms were inspected only after blind verification. They do not list this exact schema-reset finding. A [later saved WarmLedger audit](https://github.com/BrandedTamarasu-glitch/WarmLedger/blob/1c7f25f3658726d8254f5f8b91db0d1150aed953/docs/audits/2026-09-06.md) documents related stale-writer problems and subsequent coordination fixes. This pilot verifies behavior at the pinned old revision; it does not establish that every earlier reviewer missed these problems or that they remain unfixed today. The documented first-generation CAD fit failure is not counted as a new discovery.

| Evidence category | Status |
|---|---|
| Routing and domain implementation controls | Pass: 12 routing cases; both domain fixture suites retain valid controls and detected seeded failures |
| Real money tests and reproductions | Pass within the selected API/storage-adapter scope; original preflight ran 80 head and 60 parent targeted tests |
| Real CAD digital artifact checks | Pass within the limited checks described above |
| CAD source regeneration and Boolean fit/retention calculations | Not rerun; numpy/trimesh/manifold3d unavailable |
| Fresh slicing and layer/toolpath inspection | Not performed; supplied reports are historical |
| Printed-part insertion, pickup, controls, retention and stability | Not performed; pending |
| Aggregate physical acceptance | Pending |
| Added-procedure benefit | Not demonstrated on either case |

All responses were valid JSON with 494–1,147 whitespace-delimited words, below the 2,000-word bound. Tool-call counts were self-reported, with varying distinctions between orchestration calls and underlying commands. The 480-second limit and read boundaries were instruction-based with coordinator monitoring, not OS-enforced isolation or a complete access trace. Most elapsed times were unavailable; one reported 775-second duration used filesystem access time and was corrected as invalid timing evidence. It is not a measured review duration. No verified latency, token usage, cost, correction time or exact backend sampling data is claimed. Twelve completed responses and intact source hashes do not prove every resource/read constraint was satisfied.

The preparation's rounded-coordinate comparison was corrected before trials to use coordinate tolerances; no project defect or trial gain is inferred from that method correction. Raw inputs, responses, probes and detailed verification remain local. The [preparation record](../fixtures/domain-pilot/README.md) preserves provenance, hashes and limitations without publishing third-party geometry or session state.

## Decision

F5.3's bounded domain pilot is complete; pending physical work remains explicit. Keep both procedures in the evaluation cohort and preserve the baseline-favoring money result and CAD tie. F6.1 is next: consolidate the existing comparisons and identify the remaining evidence gaps before proposing additional trials. Completion of this pilot does not authorize automatic activation, new model runs, fixes to other projects, printing or publication.
