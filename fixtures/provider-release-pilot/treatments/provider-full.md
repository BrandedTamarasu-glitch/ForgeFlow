# Provider compatibility

Status: evaluation cohort, version 1. Use when external API/CLI adapters, protocol versions, response contracts or freshness behavior change. Internal edits with no provider effect need no provider trial. Normal automatic execution awaits measured qualification.

## Map the external boundary

Trace the affected adapter from request construction through parsing, normalization, cached state and user-visible status. Record provider/version, transport, required versus optional fields, units, supported ranges, pagination/completeness rules and timestamp semantics. Identify the authoritative cached result and which errors may retain it. Use the existing adapter and test seam; do not add another provider manager or task store.

Distinguish a documented contract from observed behavior and assumptions. For a real provider, verify the applicable version against its primary documentation and sanitized observations when available. A response captured from one version does not qualify another version or authenticated execution. Missing docs, environment or account access remain explicit gaps; selection does not authorize credentials, installation or live calls.

## Freeze sanitized cases

Prefer authored synthetic payloads. For captured material, remove account IDs, tokens, cookies, authorization headers, URLs with secrets, personal content and identifying metadata before committing fixtures. Review the actual fixture bytes and outputs; masking a displayed excerpt does not sanitize the stored record. Keep provenance, source revision/version, derivation/license and expected outcome beside the case. Test redaction with unmistakably fake sentinel strings, never a real credential.

Build a bounded matrix around the affected contract:

- Valid supported versions, renamed fields/units and deliberately unsupported versions. Additive optional fields may be accepted when the contract allows them; do not equate every extra field with breaking drift.
- Malformed envelopes, null/missing required fields, wrong types, partial/truncated results and pagination gaps. Partial useful data needs an explicit partial status under a declared policy, not silent full success or default values that hide missing data.
- Timeout, explicit cancellation, provider rejection and parse failure. Verify deadlines and abort propagation with controlled timers/signals. Cancellation may suppress a late result without stopping transport work; label both observations separately.
- Overlapping requests and out-of-order completions. A late prior response must not replace a newer accepted value or clear its status. Exercise the error path as well as late success.
- Multiple providers, including a healthy result beside an independent failure. One failure must not discard healthy results, cancel unrelated work or relabel unrelated cache entries.
- Stale cache, missing cache, clock boundaries and recovery after failure. Preserve original observation time; a failed refresh does not make old values fresh. Show freshness separately from request outcome so old data is not mistaken for live success.

Use explicit barriers and a controllable clock, not timing sleeps. Set the intended version, starting cache and status, event order, expected value/status and error policy before execution. Include valid controls. Bound retries, backoff and fixtures to the changed behavior; do not launch a combinatorial live test suite.

## Verify and report

Run the project's parser/adapter against the fixtures, then exercise its existing aggregation/cache path with controlled transports. Verify actual return values, per-provider isolation and status transitions, not just error messages or mock call counts. Confirm request IDs/generations or equivalent protection spans cancellation and publication. Do not forward raw error bodies, headers or credential-bearing strings into logs, reports or application state; preserve stable diagnostic codes and sanitized context instead.

Accompany stale/partial/error UI checks with readable status, keyboard access and accessible announcements where UI is in scope. A serialized status fixture cannot establish graphical accessibility or live compatibility. Without a transport seam, provide the concrete unrun schedule and name the remaining runtime gap.

Return a version/scenario matrix with source identity, exact commands, observed values and freshness/error statuses, captured-versus-synthetic provenance, sanitized evidence and unverified host/live behavior. The checkout's `node scripts/forgeflow/test-provider-compatibility.js` demonstrates a fictional versioned readings API with a manual clock; it is not a production adapter or proof of compatibility with a named service. Keep model benefit separate from fixture success and preserve independent control qualification before later pilots.

Stop after scoped cases pass or missing inputs/tools are documented. Dispose only of owned temporary clients, timers, profiles and files after preserving sanitized evidence. No credential access, deployment or destructive live operations are authorized by this procedure.
