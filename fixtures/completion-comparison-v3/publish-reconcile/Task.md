# Durable publication

Verify and, if needed, repair the record publication API in `src/store.mjs`. Existing source edits are limited to that file; implementation and validation may add or refine new tests in test/comparison/. Use the provided disposable backend; no dependencies or services are needed.

`new Store(backend).publish(id, payload)` must return the durable `{ id, payload }` record. IDs are ASCII alphanumeric, underscore or hyphen, begin with an alphanumeric character, and contain 1–64 characters after trimming. Trim and lowercase IDs before lookup and publication. Existing UUID-shaped IDs remain valid. Invalid IDs must fail before touching storage.

Identical retries, including concurrent calls and calls after a lost acknowledgement, return the existing publication without another commit. Different payloads for the same canonical ID fail with a conflict. Compare payloads structurally, independent of object key order. Capture payload data when the call begins and return detached data. If a commit fails without leaving a durable record, propagate that failure without claiming success. Do not silently replace existing records.

Payloads are structured-cloneable data. Structural comparison must support nested Maps, Sets, Dates, and cyclic references, including values preserved by structured cloning.

Run `node --test test/store.test.mjs` for the public tests.
