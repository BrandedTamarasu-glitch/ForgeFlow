# Migration fence synthetic recovery case

New authored held-out fixture for completion comparison v3. This is an in-memory synthetic store, not disk persistence or model qualification evidence. Explicit write barriers and injected write failures make concurrency checks deterministic without sleeps. The corrected source is a clean no-edit counterexample; the defective source is a recovery input.

Run `node --test test/store.test.mjs`, `node acceptance.mjs`, and `node validation.mjs`. Acceptance receives a source root as argument 2 and imports its `src/store.mjs`. The backend and private oracle stay outside trial exposure; trials receive the defective implementation, task text, API/backend contract and public tests only. Trial edits are limited to src/store.mjs and added tests. Existing studies remain untouched.
