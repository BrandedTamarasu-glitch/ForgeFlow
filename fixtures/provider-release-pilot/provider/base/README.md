# Readings cache

Repair only `src/cache.js` when justified; preserve its API. This synthetic module aggregates independent readings providers. No real provider or credentials are involved.

`createCache(clock, maxAge)` returns `refresh(key, load)` and `view(key)`. `load()` returns a promise of `{ version: 1, value: finiteNumber, observedAt: nonnegativeFiniteNumber }`; timestamps cannot be in the future. Extra fields are ignored. The most recently started refresh for a key alone may publish success or error for that key. Other keys are independent. A failed refresh retains the last accepted reading and its timestamp, exposes only the stable error code `refresh-failed`, and never forwards raw errors or payload metadata. Invalid payloads count as failed refreshes. No retries or transport cancellation are required.

`view(key)` returns a detached `{ value, observedAt, freshness, error }` object. With no accepted reading, value/timestamp are null and freshness is `missing`. Freshness is `fresh` through age `maxAge`, then `stale`. Successful refresh clears error. Refresh resolves after processing its result and must not reject on provider failure. `clock` and `maxAge` are trusted harness inputs. Keys are arbitrary strings.

Use Node's built-in test runner for any tests you add. No dependencies or network are needed. Preserve behavior that already satisfies this contract.
