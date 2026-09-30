# Capability integration and documentation

Updated 2026-09-30. **F6.3 complete for the evaluation cohort.** All nine capabilities retain evaluation status under the [readiness decision](capability-readiness.md); F6.1 qualification remains open.

## Discovery and operating guidance

The [capability contract](capability-contract.md#host-entry-points-and-packaging) identifies the managed Claude and Codex entry points and the lean Codex plugin limitation. Generated references match nine Claude workflow commands, twelve Codex workflow skills, the direct command and both discovery wrappers. The canonical guide resolves from the installed helper when invoked from an unrelated project; stdin selection creates no project state. All 28 maintained Codex agent definitions pass their drift check.

The contract now describes [ordinary task examples, explicit overrides, disabling and managed lifecycle](capability-contract.md#overrides-disabling-and-managed-lifecycle). Excluding one or all procedures does not waive acceptance criteria. Includes cannot activate evaluation procedures. Installation uses `--codex-home` for a disposable destination; update and rollback use `--home`. The nine implemented procedure files replace stale documentation that called their paths future destinations. README links expose the guidance and readiness decision. The wiki home now links the review-and-execution plan, restoring its discoverability check.

## Verification

| Check | Observed outcome |
| --- | --- |
| Capability entry-point generation | 24 maintained references agree; no generated repair needed |
| Codex agent generation/drift | All 28 agent definitions agree |
| Managed packaging lifecycle | Disposable Claude and Codex install, update, unchanged reinstall and exact rollback checks pass |
| Installed selection | Guide/selector work from unrelated directories; missing guide fails clearly; evaluation execution gates remain closed |
| Primary host | Managed Codex discovery files, inventory and workflow references installed and checked in a disposable home |
| Initial full local suite | 221/222 commands passed; wiki home omitted a maintained page link |
| Wiki correction | Targeted export check passes for 55 pages after adding the link |
| Final full local suite | All 222/222 test commands pass after correction |
| Documentation generation | 54 generated guide pages current |

The local suite includes helper tests, service tests, the Pi extension tests and TypeScript checking. Installation, manifest and updater regressions include preservation and rollback failures rather than treating a copied file as proof of successful lifecycle behavior. No hosted CI workflow is introduced.

Commands used:

```sh
node scripts/run-tests.js
node scripts/forgeflow/render-capability-entrypoints.js
node scripts/forgeflow/check-codex-agent-drift.js
node scripts/forgeflow/test-export-wiki.js
node scripts/build-docs.mjs --check
```

Validation ran on Linux with Node 26.10.0 and the private matching runtime library already used for this checkpoint. The repository recommends Node 24; this run does not claim an additional Node 24 verification. Child processes and local sockets required host execution outside the managed sandbox.

## Limits and next action

Disposable managed installation qualifies packaging and restoration, not live client discovery after restart, plugin activation, production durability, public deployment, provider access or model benefit. The user's active host profile was not modified. All nine procedures remain unexecutable in ordinary selection, and F6.1 gaps are preserved.

F6.3 is complete for the evaluation cohort. Continue to F6.4 release preparation. Prepare public-safe capability and evidence summaries without claiming activation; leave release publication and packaged-version changes to a separately authorized release.
