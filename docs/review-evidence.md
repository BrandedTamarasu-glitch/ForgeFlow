# Immutable review evidence

Each context build retains a unique run under the project's local context archive. The build result includes `run_dir` and `evidence_ref`, with an expected manifest SHA-256 and source scope. Dispatch and synthesis keep this exact reference. `context/latest` remains a compatibility projection; it is not the identity of consumed evidence.

## Build and consumption

The shared context compiler captures complete allowed source and consumed advisory inputs, the full diff summary and generated packets before sealing a manifest. Bounded displays remain previews. The source fingerprint uses the existing task-store capture and conservatively includes the repository's tracked and untracked source; generated local state is excluded. Source drift during construction prevents successful publication.

Successful runs seal the manifest last. A populated directory without a valid sealed manifest is incomplete. Interrupted runs remain available for inspection; neither directory existence nor a missing output authorizes replay. A wave resolves its parent reference once, verifies freshness and writes its child artifacts outside the sealed parent.

The maintained Claude review command and Codex review skill pin the returned reference before dispatch and reinspect it before synthesis. Budget checks target the selected run's telemetry, excluding retained history. Advisory history, lean reports and later reviewer output stay outside sealed runs. Shared installed helpers support both hosts; these checks do not establish live client dispatch or model performance.

For a consequential decision, save actual result and decision bytes outside the run, then record their consumed artifact IDs through the existing review instructions. A separate immutable consumption sidecar retains those bytes and the exact run/artifact references. Recording requires intact current source evidence. It does not determine claim truth, grant authorization or mark task acceptance passed. The [decision contract](review-decision-contract.md) keeps those meanings separate; existing task evidence can bind a saved sidecar to a criterion. Inspect the sidecar through `inspect-consumption` using the reference returned by recording; this verifies retained result and decision bytes as well as parent evidence. A task attachment alone does not verify nested sidecar files.

## Inspect and retrieve

Resolve helpers from the checkout or installed runtime. Save the returned reference JSON without changing its expected hash or scope, then use:

```sh
node scripts/forgeflow/review-evidence-cli.js inspect --root <project-root> --ref <saved-reference-json>
node scripts/forgeflow/review-evidence-cli.js retrieve --root <project-root> --ref <saved-reference-json> --artifact <artifact-id>
node scripts/forgeflow/review-evidence-cli.js inspect-consumption --root <project-root> --ref <saved-consumption-reference-json>
```

Inspection distinguishes build completeness, artifact integrity (`current`, `changed`, `missing`), source freshness (`current`, `stale`, `unknown`) and excerpt coverage. Intact historical evidence remains retrievable after source drift, but cannot become current proof for a new decision. Unknown source identity is an explicit legacy limitation, never invented current proof.

Focused retrieval accepts `--start-line`, `--end-line` and `--max-chars`, adds neighboring context and reports omitted lines/characters alongside the full artifact hash and locator. `--raw-required` refuses an excerpt or insufficient limit and includes exact bytes as base64; binary artifacts require this mode. Complete file capture proves the bytes of that file; it does not prove an already compacted digest contains the full originating command log. A raw-required digest whose original output is unavailable remains metadata-only with a named next action.

Artifact IDs resolve only through the pinned manifest. Path traversal, symlinks, hardlinks and nonregular inputs are rejected. Reads validate the opened descriptor and hashes. Missing or changed stored proof must be reported instead of silently substituting current workspace bytes.

## Capacity and retention

Default limits are 16 MiB per artifact, 256 MiB per run, 2,000 artifacts per run and 1 GiB across the retained evidence archive and consumption sidecars. Capacity checks serialize concurrent writers. Refusal preserves existing evidence and explains the need to inspect retention or choose a bounded archive; complete artifacts are never silently truncated to fit.

There is no automatic eviction. Keep referenced runs, result/decision sidecars and incomplete attempts while their decisions or reconciliation remain relevant. Before explicitly removing local evidence, inspect its consumers and retain any proof still referenced by task or review history. No pruning command or implicit retry is added in this milestone.

All run state, inputs, results and consumption sidecars remain local. Publication includes engineering behavior and limits only. The existing evaluation cohort and model defaults are unchanged; focused question assignment and bounded missing-context follow-up belong to E3.

## Validation and limits

The complete local regression suite passes 225/225 test commands. Focused validation passes 13 independent acceptance checks and 16 storage checks. Acceptance includes exact 16 MiB and binary retrieval, interrupted inventory, decision sidecar tampering, complete Git diff bytes, immutable parent/child waves, unknown-source refusal, consumption-directory projection refusal, task-feedback proof and connected-vault input preservation. Both installed hosts execute their maintained preparation shell snippets successfully. Existing packet compatibility fixtures verify behavior rather than large-repository performance.

Whole-repository freshness capture is conservative, and capacity accounting traverses retained files. Large-repository throughput and live client/model behavior remain unqualified; no benefit, normal capability activation or packaged release is inferred.
