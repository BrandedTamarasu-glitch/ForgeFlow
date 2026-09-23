# Persistence recovery

Status: evaluation cohort, version 1. Use when saves, journals, migrations, concurrent writes or cleanup change. Read-only presentation changes without storage effects need no recovery exercise. Normal automatic execution awaits benefit qualification.

## Define authority and observable guarantees

Trace the affected write/read/reload paths and their direct consumers. Identify authoritative records, derived indexes/caches, staging files, commit markers, backups and cleanup candidates. Reuse the change-propagation map when schemas or exports change. State which values must survive acknowledged saves, which partial observations are allowed, and how the application represents failed, conflicted or uncertain saves. A retryable assignment alone does not establish atomicity or recovery.

Record these boundaries in the existing task evidence:

| Boundary | Required evidence |
|---|---|
| Prepare | Which bytes may be incomplete; whether staging can overwrite authoritative data |
| Publish/commit | Exact operation making a generation visible; isolation and durability guarantees actually supported |
| Acknowledge | When success reaches the caller; how a committed operation with lost acknowledgement is reconciled |
| Reload/recover | Which record selects the current generation; compatibility validation; concrete recovery actor |
| Reclaim | How current generations, active writers, readers and retained backups are protected until deletion completes |

Separate process interruption from power loss and remote replication. A rename, lock or in-memory compare-and-swap does not by itself prove disk durability, cross-process exclusion or distributed consistency. Inspect the actual storage implementation before choosing a fix; do not impose transactions on independent writes whose contract permits partial progress.

## Exercise bounded failure schedules

Use synthetic data in an owned disposable store and the project's existing test seam. For each relevant boundary, freeze the starting bytes, ordered operations, fault, expected invariant and reload result before running. Start with one defect and one valid counterexample for the affected mechanism, expanding only for distinct failure paths. Use explicit barriers/checkpoints rather than timing sleeps.

- Interrupt before and after publication. Drop volatile state and reload through the normal reader. A staged generation is not committed just because it is newer. A committed save can survive even if acknowledgement or later cleanup fails; avoid blindly replaying external actions.
- Inject quota/write failures, including partial writes where the backend permits them. Preserve the last committed state and report the save failure. Inject removal failures separately; distinguish retained garbage from loss of authoritative data.
- Prepare two writers from the same revision, commit one, then release the other. Verify both acknowledged operations survive or the stale write is rejected explicitly. Exercise the actual bounded retry/rebase path if that is the claimed recovery mechanism.
- Pause a reader on an old generation while a writer publishes and cleanup runs. Verify the declared reader policy: pinned snapshot, restart on a changed generation, or explicit stale status. Do not silently show stale data as current.
- Pause cleanup after candidate discovery; publish or reserve a candidate before resuming deletion. A fresh reachability check followed by an unprotected delete still races. Protection must cover the deletion boundary, including live readers/writers and promised backup retention.
- Load old and new schemas, interrupt migration, and attempt a stale old-format write after migration. Preserve required values and reject unsupported future/corrupt formats without overwriting them with defaults. Test export/restore consumers when in scope.

Observe user-visible status as well as bytes: unsaved changes, conflict, recovered state and cleanup warnings must be distinguishable where the application exposes them. Report inaccessible or absent UI observations as gaps. Stop after the scoped invariants have reproducible observations or explicit missing-tool/input limitations. Without an executable seam, provide the concrete unrun schedule; do not mark it passed or test live user data instead.

## Record recovery evidence

Attach source identity, exact command, initial/final serialized state, operation order, observed errors, reload results and remaining gaps to existing task evidence. A failing schedule must violate a declared invariant; a harmless orphan alone is not committed-data loss. Re-run corrected variants and clean controls. Keep fixture success separate from actual application recovery, hardware durability and measured model benefit. The checkout's `node scripts/forgeflow/test-persistence-recovery.js` demonstrates synthetic schedules; its fixture README states the model assumptions.

Preserve evidence before removing owned disposable stores. Stop only resources started for the exercise. Do not add another task store, infer permission to migrate production data, or erase ambiguous recovery artifacts to make a test appear clean.
