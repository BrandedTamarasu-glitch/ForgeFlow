# Release qualification

Status: evaluation cohort, version 1. Web and native lifecycle branches are implemented for F3.2/F3.3. A web result does not establish installed/native qualification. Normal automatic execution awaits measured qualification.

Use for intended packaged, installed or published behavior. Source-only work without a release verification objective needs no release trial. Selection does not authorize deployment, installation, credential access or destructive actions. Reuse existing shipping evidence and the affected application's harness; do not create another release manager.

## Web: establish the target and intended artifact

Record the authorized target URL, intended source revision, build command/result, output identity, scope and observation time. Freeze a manifest from the intended build before contacting the target: entry documents, critical JS/CSS, branding/favicon and any generated assets needed by the scoped routes. Record paths, SHA256 of decoded response bodies and expected media types. If the host transforms bytes, establish a documented reproducible transform or content identity before testing; an unexplained mismatch is not a pass. For dynamic documents, isolate immutable assets and state explicitly what cannot be matched byte for byte.

A successful build, release tag, deployment log or server-declared version is supporting evidence, not proof of served identity. Derive expectations from the intended output, never from the server being checked. Include generated routes and base-path behavior where affected. Scope the inventory explicitly; a small manifest does not prove every lazy chunk or route is current.

## Web: observe delivery and behavior separately

For each scoped resource capture request and final URL, redirect chain, response status, content type, body hash and relevant cache/service-worker provenance. Follow only redirects within the authorized scope; an unexpected redirect requires investigation. A 200 HTML fallback for a JS or image request fails even when the resource URL resolves. A missing response, bodyless 304 without the matching cached body or unavailable browser remains unverified. Do not assume a HEAD response proves body identity.

Use a fresh disposable browser context and verify the bytes actually consumed for critical document/script/style resources as well as explicit asset probes. Separate those observations so a direct HTTP request cannot silently stand in for browser delivery. If caching, offline operation or a service worker is in scope, also test a returning client and update/reload behavior; a fresh context alone cannot qualify cached users. Never flush real user state or purge a public CDN just to make a check pass.

Exercise the application's scoped key interactions after identity checks: keyboard and pointer activation where relevant, navigation/reload, state or API results, readable failure states and accessible names/focus/status. Check affected viewport layouts and runtime errors. A correct asset hash does not prove a working API or interaction. Combine this with visual acceptance when layout/branding changed; serialized output alone is not accessibility evidence. Preserve both identity failures and behavioral failures instead of allowing one to hide the other.

## Native: qualify the installed lifecycle

Start with the intended source/build identity, target OS/architecture, package format, dependency/runtime versions and install/update/uninstall mechanism. Record available authority and the state migration/downgrade policy. Use the project's existing installer and release checks when available. Separate a mocked installer or file-copy fixture from the actual OS package manager, signing/notarization, desktop integration and production distribution channel. Missing platforms remain unverified; a build for a platform is not execution on that platform.

Create an owned disposable install root and profile, with synthetic saved data and an unrelated-file sentinel. Explicitly direct all profile/cache/config paths there; do not repurpose the user's home or replace a real installation. Snapshot pre-update data under the declared recovery policy. Record ownership so cleanup cannot remove unrelated applications, profiles, services or files.

Freeze hashes from the intended built artifacts before installation. Verify installed bytes, permissions, dependencies and the launch target resolved by the real entry point. Launch the installed executable from an unrelated working directory; identify the executing binary using host-supported process evidence, not just a self-reported version. A successful build and an unchanged old installation must fail identity qualification. For application bundles, include scoped libraries/resources/shortcuts and generated launchers, not only the main executable.

Exercise separate process launches for first run and restart, verifying the actual saved values and visible result. Update through the supported mechanism, verify installed identity again, and check migration preserves declared data. Restart the updated application. Exercise failed launch, malformed state and a stale install as relevant controls. A mocked successful process result is build/mock evidence only.

Test rollback of both executable and data under an explicit compatibility policy. Newer data may be unreadable by an older binary; safe rejection with preserved bytes differs from successful recovery. Restoring a snapshot can discard post-update changes, so state that loss and require the applicable authority before doing it to real data. Do not erase a profile to make rollback appear successful. Verify uninstall removes owned application artifacts while honoring the declared user-data retention policy; check unrelated files/profiles remain intact. Reinstall when retention is part of the contract.

For graphical applications, qualify actual-window launch, keyboard/focus, readable scaling, accessible names/status, error recovery and any platform-specific permissions or integration affected by the release. A CLI fixture cannot establish desktop or assistive-technology behavior. Keep automated installed checks, actual-host observations and human checks in separate report fields, with unavailable checks explicitly unverified.

The checkout's `npm run test:native-release` compiles an authored C fixture and runs installed ELF binaries on Linux with disposable profiles. Compilation, installed byte identity and actual process/state observations are separate from its simulated file-copy installer; it does not qualify a production package or OS installation service. It checks incompatible binary-only rollback before explicit snapshot recovery and verifies owned cleanup. No download, administrator access, host configuration change or production installation is needed. Existing `render-post-release-install-verify.js` and runtime drift evidence complement this procedure; mocked runners cannot substitute for actual host launches.

## Evidence, stop conditions and cleanup

Report intended, built and observed identities; per-resource and per-interaction pass/fail/unverified results; exact commands, environment/browser and scope. Keep local simulation, staging, public, installed, actual-host and human observations separate. Any required failure blocks qualification; any missing required evidence leaves qualification incomplete. Do not turn unavailable tools into a pass. A clean local case and seeded stale/mixed/missing/interaction failures check the harness, not an actual public release or model benefit.

The checkout's `npm run test:web-release` exercises authored synthetic HTTP deployments on an ephemeral loopback port. It records hashes and browser observations in a temporary results directory. Existing release metadata checks, including `render-release-verify.js`, complement this procedure but do not replace served-body checks. No public deployment is performed by the fixture suite.

Stop after the bounded matrix is observed or its gaps are recorded. Close owned browser contexts, processes and servers; preserve sanitized evidence and remove only owned disposable state when appropriate. Verify cleanup, including child processes, temporary launchers/services and profile residue where applicable. Never retain cookies, authorization headers, private API bodies or credential-bearing URLs in published reports. Native platforms and lifecycle steps not exercised remain unverified.
