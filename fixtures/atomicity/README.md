# Atomicity and retry examples

These newly authored synthetic examples exercise the distinction between repeatable writes, atomic visibility, concurrent updates and real recovery. No external service, user data or database is used.

Run `node scripts/forgeflow/test-atomicity-guidance.js` from the repository root.

`evaluation-manifest.json` freezes prompt-only task inputs, source/key hashes, provenance and scoring criteria for the [skill comparison protocol](../../docs/skill-evaluation.md). Run `node scripts/forgeflow/test-skill-evaluation.js` to verify this corpus and the deterministic schedule. The example is fixture-only; no model trials have been run.

`operations.js` contains the code models. `answer-key.json` contains requirements and expected outcomes. For future reviewer evaluations, provide only the selected operation and its requirement to the initial reviewer; keep expected outcomes, mechanisms and test assertions out of that input. These deterministic checks are not model trials or evidence of improved reviewer accuracy.

The tests expose a reader between two writes and interrupt publication; replay stale writers in a fixed schedule; reject a stale conditional update and explicitly retry it; and permit independent writes whose contract tolerates partial progress. They also demonstrate a non-idempotent upsert conflict action.

The snapshot swap and compare-and-replace are atomic in this single-threaded model. Applying either pattern to a real database or filesystem requires separate evidence of that system's publication, isolation and durability guarantees. The examples do not prove a particular database isolation level sufficient. They model neither distributed delivery guarantees nor crash durability of an in-memory store.

Historical debate reports describe earlier experiments and retain their original outcomes. Their blanket retry/idempotency conclusions are superseded by the current canonical guidance: specify the invariant, observable intermediate states, concurrent interleavings and actual recovery actor; use a failing schedule to establish a defect and its impact. Unknown context is neither proof of safety nor a blocker by itself.
