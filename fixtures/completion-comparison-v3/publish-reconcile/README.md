# Publish reconciliation comparison case

This is a newly authored synthetic held-out task using a disposable deterministic in-memory backend. The defective seed has known shortcomings in canonical ID handling, conflict handling, payload capture, concurrent reconciliation, and lost-acknowledgement recovery. It is not historical production source and establishes no hardware or live-service benefit.

Trial edit ownership is only `src/store.mjs`; seed trials by replacing its contents with `src/store-defective.mjs`. Keep the defective source, README, acceptance oracle and mutation metadata outside trial context. The public test file and backend are fixed. The oracle accepts a source root as argument 2 and loads that root's `src/store.mjs`, while using its own fixed backend.

Validation: `node --test test/store.test.mjs`; `node acceptance.mjs .`. All barriers are explicitly released; no network, timers or third-party packages are used.

`node validate.mjs` checks the corrected source, defective seed, and four exact portable mutations from `mutations.json` in disposable temporary directories. Each oracle child has a 1.5 second deadline. Its fourteen checks include ordinary and UUID publications, order-independent equality, nested Map/Set/Date compatibility and conflicts, detached cyclic retries, detached results, invalid input, sequential and concurrent conflicts, lost acknowledgements, concurrent retries, caller mutation during publication, and failures before durable commit.
