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

## Real-PR acceptance

The initial E2 source checkpoint completed regression validation before its real-PR acceptance gate. This follow-up supplies that missing gate and makes real-PR acceptance a standing roadmap requirement in `AGENTS.md`.

Validation used owned [baa-ton-forge PR #33](https://github.com/BrandedTamarasu-glitch/baa-ton-forge/pull/33), “Scope acceptance validation by task and integration phase.” Original base and verified merge base: `f9bb8700bab14ff31dd09059250e8eae7290bbf2`; submitted head: `19fb7b220115fe392301ecb6179f7478c78cff83`. The submitted tree `f8a91f2d5fc0484ed41537687017fbe519f271e8` was verified across all 17 changed files in a disposable checkout. E2 runtime source was the committed `348da5a` implementation.

Seven observations passed on that actual change:

- PR ancestry, file scope and submitted tree match the pinned GitHub revisions.
- The original PR's six focused test files pass 67/67 checks; complete command output is retained.
- A subsequent pair of concurrent packet builds preserves the first run's exact sealed bytes and distinct identities.
- Bounded source preview reports omissions; raw-required retrieval returns the exact submitted `acceptance.js` and complete base-to-head Git diff. An excerpt cannot satisfy raw-required retrieval.
- The actual scoped source assessment and complete test output are retained separately with exact references to the consumed acceptance, verification-handoff and diff artifacts.
- Interrupted capture retains original PR source without a successful seal.
- Advancing Git identity to the submitted commit, without changing application bytes, makes prior proof stale for new decisions and waves while retaining intact historical retrieval.

Source assessment follows the PR's original contract: pre-integration criteria remain cumulative at final verification, and other-task/later-phase criteria remain pending. No introduced violation was reproduced in the reviewed scope. Application source bytes remained unchanged, and the disposable checkout ended clean at the submitted head.

This is one reused owned PR and a local evidence-flow qualification. It does not provide a new-case accuracy comparison, live native-host qualification or measured model/performance benefit. No new model batch, GitHub workflow, PR comment or application source push was performed. The prior regression results remain supporting engineering evidence; they do not substitute for this real-PR gate.
