# Draft shelf

A synthetic multi-window notes service. Run `node --test test/smoke.test.js`.

Keep the exported APIs and stored format compatible. `Shelf` instances can share one backend. Every successful `append(id, text)` must remain readable after reopening; repeated delivery of the same ID is a no-op. Distinct accepted IDs must not overwrite one another. A save uses schema 2 (`notes`); existing schema 1 (`entries`) data must retain its values when upgraded. Unknown schemas must fail without writes. Notes have string IDs and text.

`sweep()` reclaims unreferenced generations. It may run while a save is publishing; committed state must remain readable. The backend's conditional publication and conditional deletion methods are atomic. Other backend operations are asynchronous boundaries. Generation keys are unique. There are no long-lived pinned readers or retained-backup requirements. Failed removal may retain garbage and must be reported; it does not undo a committed save. A reopened shelf reads the published generation, not the newest staged blob.

The backend is an in-memory serialized-byte test adapter. No disk, network, real user data or UI is involved. Its `afterList` hook models a competing publisher during enumeration. Production durability is outside this exercise.
