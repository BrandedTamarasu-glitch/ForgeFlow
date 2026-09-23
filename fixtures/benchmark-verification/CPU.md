# Reproducible CPU example

Run from the repository root with `NODE_OPTIONS` unset:

```sh
timeout 30s node fixtures/benchmark-verification/cpu.cjs > /tmp/forgeflow-cpu-observation.json
```

Use a new output filename for each attempt; preserve its exit status and any failure/timeout diagnostic. A timed-out process may produce no JSON; that is an unsuccessful attempt, not a sample to discard. The script uses Node built-ins and no network. Run `node scripts/forgeflow/test-benchmark-cpu.js` for correctness/control and aggregation checks. Keep raw observations local; publish only reviewed aggregate results.

The fixed input cycles through integers -50 through 49 in a 100,000-element Float64Array. Each sample processes twenty batches, two million element evaluations. The expected checksum comes from the independent sum-of-squares formula, not the other implementation. The allocating implementation copies to an Array, maps squares and reduces; the indexed implementation accumulates directly. Both are synchronous CPU JavaScript. Instrumented function counters observe the executed implementation. This is not a CPU-versus-accelerator comparison or an isolated compiler optimization experiment.

Two warmups and six measured repetitions per arm run in alternating order. The measured interval includes dispatch, all twenty batches, allocations and completed checksum; input creation and the subsequent correctness check are excluded. `elapsed_ns` uses a monotonic clock. The summary's `median_batch_ms` describes the entire twenty-batch sample, not a single element or individual inner batch. Aggregate throughput is total correct element evaluations divided by total measured seconds. Warmups remain in the raw record and are excluded from summaries. No measured speed threshold appears in regression tests.

The disable control dispatches to the allocating implementation; forbidden fallback returns before either implementation runs; restore returns to indexed execution. An injected wrong checksum fails the independent oracle. The emitted identity includes script SHA-256, containing Git revision, Node/V8, flags, OS/kernel, CPU model and exact command. A source hash identifies uncommitted script bytes; the Git revision alone does not identify those bytes. It records no hostname, username or full environment. Power mode and competing workloads remain uncontrolled/unobserved. Input is synthetic, timings are actual CPU observations.

Memory, power and energy are null, not estimated from timing or allocations. A processor model containing a graphics name is not execution evidence for that device. Thread counts, clocks, thermal effects, cold starts, different inputs and repeated independent sessions require separate work. Keep all measured values and failed attempts when comparing runs; do not select the fastest run. The thirty-second bound is enforced by the outer command, so use it for reproduction.

The example and tests are newly authored under the repository MIT license. Model comparisons require separate frozen inputs, independent control review and authorized trial execution. See [pilot preparation and results](../../docs/benchmark-cpu-pilot.md).
