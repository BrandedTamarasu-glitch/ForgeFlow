# Served release gate

Repair only `src/qualify.js` when justified; preserve its API. `qualify(origin, manifest, interaction)` returns `{ identity, interaction, qualification }`, each `pass`, `fail` or `unverified`. The origin is a trusted authorized loopback URL. The nonempty manifest is frozen from the intended build: `{ path, sha256, type }` entries with unique absolute paths, lower-case MIME type and SHA256 of decoded bodies. Manifest validation is out of scope.

Use actual HTTP GETs to compare every declared body, status and media type. A server-declared version is not artifact identity. Redirects are disallowed and must not be followed. A non-200/non-304 status, MIME mismatch or body mismatch is a failure. A 304 without a cached body or a network/body-read failure is unverified. Media-type parameters are allowed. Preserve known failures even when another resource is unverified. Do not contact a redirect target.

Call the supplied async `interaction()` once even when artifact identity fails. It returns `true` for a verified key interaction, `false` for observed failure, or `null` for unobserved; a thrown exception is unverified. Overall qualification is fail if either dimension fails, otherwise unverified if either is unverified, otherwise pass. These are local HTTP/interaction-callback checks, not browser accessibility or public release qualification. No deployment, credentials or dependency installation.

Use Node's built-in test runner for tests you add. No dependency package is needed.
