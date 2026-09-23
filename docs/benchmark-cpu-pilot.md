# Benchmark CPU pilot

Status: F4.2 completed, 2026-09-23. Actual CPU measurement, preflight and all twelve real-project reviews are complete. Independent verification found four distinct introduced problems across both arms. Baseline found more on these cases; no added-procedure benefit or activation qualification.

## CPU observation

The [reproducible example](../fixtures/benchmark-verification/CPU.md) compared two CPU implementations over identical synthetic integers. Each sample completed twenty 100,000-element batches, with an independent exact checksum oracle. Two warmups and six measured repetitions per implementation ran in alternating order. All sixteen warmup/measured samples were correct. Disable, forbidden-fallback, restore and deliberately incorrect-output controls passed.

| Observation | Allocating CPU implementation | Indexed CPU implementation |
|---|---|---|
| Median time per two-million-element sample | 59.2601095 ms | 6.0860805 ms |
| Minimum to maximum sample time | 58.446757–76.714852 ms | 6.041372–6.109990 ms |
| Aggregate correct element evaluations per second | 32,052,721.86 | 329,092,835.03 |
| Memory, power, energy | Unmeasured | Unmeasured |

The predeclared descriptive hypothesis, lower indexed median time with correct output, held in this run. This is one process on one machine, not statistical significance or general application performance. Both paths executed CPU JavaScript. The allocating path's copy/map/reduce allocations are inside its measurement interval; the comparison is intentionally an end-to-end implementation change. Uncontrolled competing workload, runtime compilation/GC and power/thermal state limit extrapolation.

Source identity: `cpu.cjs` SHA-256 `bb14eb87795a3a6777db36515007343fb9677a8821e25899aa0bbdfb20b1627e`, based on repository revision `eab6f1c38bab18653a121e9c7bd3c2e5dcd630c1` with this new script uncommitted. Node v26.9.0, V8 14.6.202.34-node.32, Linux x64 kernel 7.2.6-1-cachyos, AMD Ryzen 7 PRO 250 w/ Radeon 780M Graphics, sixteen logical CPUs. No Node flags or `NODE_OPTIONS`; synchronous single-threaded dispatch with possible runtime/GC worker activity. No GPU or NPU execution. No separate compiled artifact or external dependency.

The initial sandboxed launch failed before measurement because Git source-identity lookup could not spawn. The subsequent permitted launch completed within its thirty-second deadline. This setup failure is retained separately from the successful CPU run and is not a model trial. Raw samples stay local; the reproduction command and measurement boundaries are in [CPU.md](../fixtures/benchmark-verification/CPU.md).

## Revised comparison: established project changes

The proposed eighteen-trial supplied-evidence comparison was withdrawn before any model execution. Its authored claim variations risked repeating the ceiling effects of earlier pilots. The CPU example remains implementation evidence; it is not the primary model-benefit evaluation.

The comparison used pinned, published performance changes with identical source, diff, existing tests, repository guidance and execution budgets across arms. Only the enhanced arm received the benchmark procedure. Reviewers discovered and substantiated issues themselves. Three repetitions per arm used counterbalanced order; all scheduled results were retained, and findings were blindly verified before revealing arm labels. The outcomes distinguish verified mechanisms, repeatability, baseline-only findings, unsupported findings, incomplete attempts and observed overhead. Without an exhaustive correctness key, no general accuracy or recall percentage can be calculated.

Selected revisions after source isolation and independent preflight:

- **WarmLedger month-sharded ledger benchmark**, commit `a2d67075bbc98625d2c6e7f89aa1a384e581a1fe`. Real CPU/storage benchmark code and published write-volume claims, with synthetic ledgers and executable checks. The earlier benchmark introduction (`1602cb48a4f1e3df58125f5d2616ecd96fb107c3`) is related context, not an independent project.
- **OllamaAMDNPU benchmark tooling**, commit `9bfe13a0a78415806e81d22748478aeade0b4bd6`. Published backend/performance work provides a different domain. Source and controlled execution may verify attribution or measurement defects; actual NPU performance remains unverified without matching hardware and runtime.

Neither repository exposed PR records through the GitHub PR list at selection time, so exact commit/base pairs were used. Selection followed relevance and testability before treatment outcomes were observed. Scope and budgets were frozen after preflight and before trial output. NPU history includes previously fixed isolation and baseline-attribution mistakes; those informed the boundary between known-defect validation and new discovery. Later fixes and answer keys were excluded from trial contexts.

The earlier study reviewed other WarmLedger behavior, so this is a new subsystem/change rather than an entirely new project. That exposure limits independence at the project level; baseline guidance was preserved. Both candidates passed independent snapshot/parent/diff and bounded testability checks. The NPU benchmark consumer was added before freeze; its referenced contribution guide is absent from the pinned source tree, and external compiler/hardware remain unavailable. Twelve review slots are frozen: two cases × two arms × three repetitions, with identical existing reviewer guidance, 48 tool calls, 2,000 response words and 480 seconds per slot. Only enhanced receives the benchmark procedure. Reviews ran in fresh contexts, two concurrently; arm starting order alternated and was balanced across cases. All outputs were collected before blind verification. F4.2 reporting is complete. The earlier request to authorize one control review and eighteen supplied-claim trials is superseded; no such trial has run.


## Real-project results

All twelve scheduled reviews completed in twelve distinct contexts. Source/input hashes, response format, 48-tool and 2,000-word limits passed. Reviews used 6–18 completed tool calls and 344–753 response words. No timed-out, failed or replacement trial; one complete enhanced ledger review reported no findings. Missing findings are not inferred to mean the source is clean.

The seventeen submitted findings reduce to four independently confirmed introduced mechanisms. Dispositions were saved before opening the arm mapping. Verification used separate project-specific contexts without trial prompts, peer outputs or arm identities. This is procedural blinding, not a guarantee that prose style cannot suggest a treatment. There is no exhaustive answer key and no general accuracy or recall estimate.

| Outcome | Baseline | Added benchmark procedure |
|---|---:|---:|
| Completed / scheduled reviews | 6 / 6 | 6 / 6 |
| Verified finding occurrences | 10 | 7 |
| Distinct verified mechanisms | 4 | 3 |
| Unsupported primary mechanisms | 0 | 0 |
| Unresolved primary mechanisms | 0 | 0 |

Occurrences count the same verified mechanism again when found in another review; they are not distinct bugs. Ledger per-repeat counts were baseline **2, 2, 2** and enhanced **2, 2, 0**. NPU counts were baseline **1, 1, 2** and enhanced **1, 1, 1**.

| Confirmed mechanism | Baseline frequency | Enhanced frequency |
|---|---:|---:|
| Ledger retains every repetition's prepared stores, increasing heap requirements | 3/3 | 2/3 |
| Ledger timing arms have different snapshot histories, confounding comparison | 3/3 | 2/3 |
| NPU report declares a performance gate using unmatched prompt workloads | 3/3 | 3/3 |
| Newly accepted zero-padded tile width can promote artifacts then leave an empty manifest | 1/3 | 0/3 |

**The added procedure showed no discovery advantage here.** Baseline produced more verified occurrences and one additional distinct mechanism, found once. This is counterevidence to assuming the benchmark procedure improves this review task. The small sample does not establish that it always hurts performance, just as the earlier real-project gains for other procedures did not establish general superiority. Keep benchmark verification in the evaluation cohort. These results neither erase earlier gains nor justify changing the test until it favors the procedure.

## Independent verification and limits

- **Iteration retention:** at 36 months × 100 expenses and twenty iterations, the base completed with a 128 MiB V8 heap limit; the head exhausted that heap. The head's one-iteration control completed. Separate forced-GC instrumentation showed retention increasing with repetitions. This confirms a bounded failure and the mechanism, not universal failure under default heap limits or every submitted RSS/timing estimate.
- **Snapshot-history confound:** a four-condition synthetic check isolated layout from snapshot history. Both layouts performed two snapshot reads with empty history and four with migration history. The changed benchmark gives that migration history only to the sharded arm. Snapshot processing code itself is unchanged. This confirms unequal timed work, not a particular millisecond penalty or that the storage optimization lacks benefit.
- **Unmatched NPU baseline:** the new report applies a CPU observation at prompt length 160 to NPU observations at 32, 64, 128, 256 and 512, then declares the gate passed. Source and report arithmetic verify the mismatch; no measured CPU points match that sweep. Actual CPU/NPU superiority and the estimated crossover remain unverified. This is distinct from the previously documented CPU-versus-Vulkan label correction.
- **Numeric tile width:** controlled copies changed only four directory assignments to disposable paths. With staged sentinel artifacts and no compilation, `--tile-n 0256` derives inner width 43 through octal arithmetic, promotes staging, then fails Python manifest generation, leaving an empty manifest. Decimal `256` succeeds with inner width 64. The base rejects the new option before promotion. A similar padded `--tile-m` metadata problem already existed; that broader old problem is not counted as introduced. No generated accelerator binary was validated.

The primary mechanisms in all seventeen findings were confirmed, reducing to four distinct problems. Incidental numerical estimates, larger unrun reproduction variants and hardware-dependent implications in review prose were not thereby verified. The memory verification encountered an initial sandbox child-process output-collection problem; direct bounded CLI runs resolved the result and were retained. The finding concerns the benchmark harness, not financial-record corruption. Real-project review source remained unchanged; diagnostic copies and reproductions stayed local.

The ledger case is a new change/subsystem within a project used earlier. The NPU case is the selected published tooling/report change, with relevant source included rather than a full hardware build environment. Neither repository exposed PR records at selection time, so the study uses exact commit/parent pairs. No check of saved prior reviews establishes that these four findings were historically missed, and current upstream remediation status was not assessed. Discovery here means found without supplied claims or a bug key; it does not mean first discovery by anyone.

## Reproducibility and overhead

Pinned base/head pairs:

- WarmLedger: `6826461abfd767151ebacc5b9c7ba1bdc41534b4` → [`a2d67075bbc98625d2c6e7f89aa1a384e581a1fe`](https://github.com/BrandedTamarasu-glitch/WarmLedger/commit/a2d67075bbc98625d2c6e7f89aa1a384e581a1fe).
- OllamaAMDNPU: `0823376bf9c075ab16469285509c2cd37f87c089` → [`9bfe13a0a78415806e81d22748478aeade0b4bd6`](https://github.com/BrandedTamarasu-glitch/OllamaAMDNPU/commit/9bfe13a0a78415806e81d22748478aeade0b4bd6).

Frozen protocol SHA-256: `349d8489bac8397c017214d747ae196dc914d32f13c4a7b8f617d00602929918`. Blinded adjudications SHA-256: `9feb2095a8b73b0fc253a3058883f2453bb1367225365d0b63eff46a0d22a14b`. Raw prompts, events, outputs, source snapshots, reproductions and mapping remain local and excluded from publication.

Each review used a fresh ephemeral CLI context with `gpt-6-astra`, CLI default reasoning/settings, no user configuration, and the same existing security/efficiency review reference. Exact resolved backend and hidden sampling settings remain unverified. Added guidance increased the prompt by 6,007 UTF-8 bytes. Filesystem boundaries were instructional plus source/addition hash checks; they were not a complete OS-level prohibition on all reads. No logged HOME overrides were observed.

Across twelve reviews, reported usage was **6,461,586 input tokens**, including **5,801,856 cached input tokens**, and **65,110 output tokens**. Baseline input/output: 3,542,835 / 32,387; enhanced: 2,918,751 / 32,723. Cached input is already included in input totals. Mean wall time was 198.1 seconds baseline and 195.6 seconds enhanced; individual reviews ranged from 121.7 to 281.7 seconds. Wall time includes tool execution and concurrent scheduling, not pure model latency. These totals exclude preparation and independent verification; exact cost and correction time remain unknown. One small comparison does not establish efficiency superiority.

F4.2 is complete as a scoped CPU example and comparison report. Normal automatic activation remains gated. Next implementation item: **F5.1 money/calendar correctness**. The study did not modify the reviewed applications or post public issue reports.
