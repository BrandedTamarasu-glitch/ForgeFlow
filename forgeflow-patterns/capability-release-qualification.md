# Release qualification

Status: evaluation cohort, version 1. The web branch is implemented for F3.2. The native lifecycle branch remains unavailable until F3.3; do not treat a web result as installed/native qualification. Normal automatic execution awaits measured qualification.

Use for intended packaged, installed or published behavior. Source-only work without a release verification objective needs no release trial. Selection does not authorize deployment, installation, credential access or destructive actions. Reuse existing shipping evidence and the affected application's harness; do not create another release manager.

## Web: establish the target and intended artifact

Record the authorized target URL, intended source revision, build command/result, output identity, scope and observation time. Freeze a manifest from the intended build before contacting the target: entry documents, critical JS/CSS, branding/favicon and any generated assets needed by the scoped routes. Record paths, SHA256 of decoded response bodies and expected media types. If the host transforms bytes, establish a documented reproducible transform or content identity before testing; an unexplained mismatch is not a pass. For dynamic documents, isolate immutable assets and state explicitly what cannot be matched byte for byte.

A successful build, release tag, deployment log or server-declared version is supporting evidence, not proof of served identity. Derive expectations from the intended output, never from the server being checked. Include generated routes and base-path behavior where affected. Scope the inventory explicitly; a small manifest does not prove every lazy chunk or route is current.

## Web: observe delivery and behavior separately

For each scoped resource capture request and final URL, redirect chain, response status, content type, body hash and relevant cache/service-worker provenance. Follow only redirects within the authorized scope; an unexpected redirect requires investigation. A 200 HTML fallback for a JS or image request fails even when the resource URL resolves. A missing response, bodyless 304 without the matching cached body or unavailable browser remains unverified. Do not assume a HEAD response proves body identity.

Use a fresh disposable browser context and verify the bytes actually consumed for critical document/script/style resources as well as explicit asset probes. Separate those observations so a direct HTTP request cannot silently stand in for browser delivery. If caching, offline operation or a service worker is in scope, also test a returning client and update/reload behavior; a fresh context alone cannot qualify cached users. Never flush real user state or purge a public CDN just to make a check pass.

Exercise the application's scoped key interactions after identity checks: keyboard and pointer activation where relevant, navigation/reload, state or API results, readable failure states and accessible names/focus/status. Check affected viewport layouts and runtime errors. A correct asset hash does not prove a working API or interaction. Combine this with visual acceptance when layout/branding changed; serialized output alone is not accessibility evidence. Preserve both identity failures and behavioral failures instead of allowing one to hide the other.

## Evidence, stop conditions and cleanup

Report intended, built and observed identities; per-resource and per-interaction pass/fail/unverified results; exact commands, environment/browser and scope. Keep local simulation, staging, public, installed, actual-host and human observations separate. Any required failure blocks qualification; any missing required evidence leaves qualification incomplete. Do not turn unavailable tools into a pass. A clean local case and seeded stale/mixed/missing/interaction failures check the harness, not an actual public release or model benefit.

The checkout's `npm run test:web-release` exercises authored synthetic HTTP deployments on an ephemeral loopback port. It records hashes and browser observations in a temporary results directory. Existing release metadata checks, including `render-release-verify.js`, complement this procedure but do not replace served-body checks. No public deployment is performed by the fixture suite.

Stop after the bounded matrix is observed or its gaps are recorded. Close owned browser contexts and servers, preserve sanitized evidence and remove only owned disposable state when appropriate. Never retain cookies, authorization headers, private API bodies or credential-bearing URLs in published reports. Native first-run/restart/update/uninstall/rollback qualification remains pending F3.3.
