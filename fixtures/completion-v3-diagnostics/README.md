# Completion comparison v3 diagnostics

These diagnostics are separate from the frozen comparison v3 oracle, source inputs and primary scores. No frozen check or model prompt changes.

## Overlapping reloads

Discovered after freeze and before migration trial observations. The prepared migration reference passes its 13 frozen checks but can retain loaded state after a failed reload when calls overlap:

1. Load valid revision 0 and start another valid reload.
2. Publish a future-version document at revision 1, then start a second reload before awaiting either call.
3. The earlier reload exposes revision 0; the later reload rejects the unsupported version.
4. Snapshot access and local editing remain enabled. Flush rejects the stale revision, so the durable future document remains intact.

Run `node fixtures/completion-v3-diagnostics/overlapping-reload.mjs` to reproduce using the frozen reference and provided backend. No services, sleeps, source edits or model calls are involved.

The task states that a failed reload invalidates previous loaded state without a nonoverlap precondition. Same-instance overlapping reloads are not explicitly required, unlike concurrent stores; retain this applicability caveat. This gap limits clean-control and false-finding interpretation for the migration case. An edit alone is not a false defect claim. Preserve every frozen outcome and report this diagnostic separately; do not reinterpret its assertions as additional primary acceptance checks or evidence of a durable overwrite.

## Shared publication payloads

Discovered during publication trial observations and confirmed separately on the frozen reference and provided backend. `structuredClone` preserves shared backing storage for SharedArrayBuffer values. Consequently, caller mutation after publication and mutation through the returned record both alter stored bytes without another commit. A deterministic commit barrier also permits bytes to change between call entry and publication. This contradicts the task's capture and detached-return requirements for its permitted structured-cloneable payloads, which do not exclude shared buffers.

Run `node fixtures/completion-v3-diagnostics/shared-publication.mjs` to reproduce. This is in-memory aliasing, not evidence about disk durability. The prepared reference's 14 frozen checks omit this path, so publication clean-control and false-finding interpretation are limited. Preserve the frozen scores and distinguish a real shared-memory finding from an unnecessary edit.

The same diagnostic observes that Errors with different preserved stacks compare equal under `isDeepStrictEqual`. Whether stack text participates in structural payload equality is unspecified in the task. Record that behavior as an ambiguity, not a confirmed contract violation.
