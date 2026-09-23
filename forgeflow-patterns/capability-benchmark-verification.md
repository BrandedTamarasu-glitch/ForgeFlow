# Benchmark verification

Status: evaluation cohort, version 1. Use for optimization, performance or hardware-offload claims. Ordinary edits without a performance objective do not need a benchmark. Normal automatic execution awaits measured qualification. Reuse the project's harness and task evidence; do not introduce a second benchmark service.

## Freeze the claim and comparison

Write a falsifiable hypothesis with workload, baseline, treatment, metric, units, scope and acceptance threshold before looking at results. Separate product acceptance from statistical evidence. Specify identical input bytes, problem size, batch size, concurrency, precision, output tolerance and completed work. Freeze the correctness oracle independently of the optimized implementation. A faster wrong answer cannot pass.

Record source revision and dirty patch identity, built artifact hash, exact build and run commands, dependency/runtime/compiler versions, relevant flags and sanitized environment. Record CPU/device model, OS, driver/runtime, thread limits, device selection, power mode and competing workload where observable. Unknown details stay unknown. Never publish secrets or machine/account identifiers as benchmark metadata.

Predeclare bounded warmups, repeat count, maximum duration, timeout, baseline/treatment order and stopping rule. Use at least three repeats for a small pilot; that is a minimum observation count, not statistical qualification. Counterbalance order and retain all scheduled outcomes, including failed, timed-out or incorrect runs. Do not silently rerun only failures, drop slow samples, tune the threshold after observation or combine samples across changed builds. Keep cold-start and steady-state policies distinct; name cache state and setup/compilation inclusion.

## Verify execution and controls

A requested backend, installed driver, device enumeration or optimistic log does not attest execution. Trace the measured operation through dispatch and completion using runtime profiling, operator placement, execution counters or another backend-specific observable. Check fallback paths, mixed operator placement, device transfers and asynchronous completion. Synchronize the work before ending the interval; host submission time alone is not device completion latency. Scope attribution to the operators actually observed. Explain profiler overhead and collect comparable evidence for both arms.

Establish a negative control before trusting attribution: disable or make the claimed backend unavailable using an owned disposable configuration. Verify actual behavior changes to an observed fallback or explicit failure. A flag that only changes labels, logs or the requested device fails this control. With fallback forbidden, require failure before useful work; with fallback allowed, preserve correctness and label the executed fallback. An unchanged duration alone neither proves nor disproves backend use. Restore the setting and verify the intended path returns. Do not modify global drivers or host power settings without applicable authorization.

Run an independent correctness check for every warmup and measured run, including the control. Include a deliberately wrong-result variant to prove the oracle can fail. Control execution evidence and output values must come from actual operations in the harness, not be inferred from the configuration. Missing attribution evidence remains unverified even if measured speed improves. CPU or simulated backends cannot qualify an unavailable GPU/NPU.

## Measure only supported quantities

- **Latency:** elapsed time for the specified completed operation, in explicit units. State whether setup, queueing, transfers and synchronization are included. Retain per-run values; report median and spread, and tail percentiles only with adequate samples and a declared method.
- **Throughput:** correctly completed items divided by the corresponding measured interval, with batch/concurrency and workload stated. Do not equate reciprocal request latency with throughput under batching, queueing or parallel execution.
- **Memory:** instrument the relevant process/device allocation or peak/resident metric and its sampling boundary. Payload size is not peak memory; host RSS is not device memory. Missing measurements stay null/unverified.
- **Power and energy:** record sensor/instrument, sampling, idle baseline and integration interval. Watts, joules and energy per correct item are different quantities. Lower elapsed time does not establish lower power or energy.

Keep raw samples, units, interval boundaries, warmup designation, completed item counts, correctness, executed-backend observations and all failure reasons. Use a readable table alongside any chart. Compare like metrics and summarize the distribution without claiming broad significance from a tiny or synthetic sample. Missing instrumentation blocks only its metric; incorrect output or invalid attribution blocks claims that depend on it.

## Report and stop

Return the frozen hypothesis, reproducibility commands and identities, workload/environment, control observations, raw sample references, correctness outcomes, per-metric results and explicit unknowns. Distinguish executable fixture checks, actual CPU/device measurements and model-benefit trials. The checkout's `node scripts/forgeflow/test-benchmark-verification.js` uses deterministic synthetic timings and an instrumented in-process backend model. It checks attribution and reporting rules; it measures no accelerator performance or real power/memory benefit.

Stop at the declared budget or after scoped checks complete. Preserve sanitized evidence, stop owned workers and restore only settings changed by the experiment. Missing hardware yields an unrun plan with the precise evidence gap, never a fabricated speedup. Later model pilots need independently checked controls and hidden correctness checks; this fixture alone establishes no agent benefit.
