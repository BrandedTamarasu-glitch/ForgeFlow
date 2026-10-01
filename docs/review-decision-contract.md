# Consequential review decisions

Status: E1 contract frozen for local pilot preparation. [E2 runtime evidence storage](review-evidence.md) is implemented and verified against a real owned PR. E3 focused questions and bounded follow-up are implemented; PR-scoped neutral challenge evidence is retained; general quality and comparative overhead remain unqualified. Use this record only for claims that can change a repair, blocker, acceptance or handoff decision.

## Consumers and boundaries

Ordinary review dispatch supplies a concrete question and evidence scope. Selected-risk verification tests the proposed explanation; synthesis resolves supported, contradicted and unresolved claims; final validation checks that the resulting decision still matches current evidence. These are the existing review stages in `commands/review.md`, not new verdict formats.

The existing `check-review-evidence-schema.js` checks finding shape and hazards, not whether a finding is true. Keep its finding format. A claim record is a versioned sidecar linked to a finding or question; it does not alter immutable evaluation trial records.

## Record

```json
{
  "schema_version": "1",
  "claim_id": "case-question-1",
  "question": "Does the declared caller retry a rejected update?",
  "claim": "Two accepted updates lose one increment.",
  "judgment": "unresolved",
  "observed_facts": [
    { "statement": "A version mismatch returns false.", "evidence_ids": ["source-1"] }
  ],
  "assumptions": ["The caller does not retry."],
  "evidence": [
    {
      "id": "source-1",
      "source_revision": "exact source revision",
      "artifact_sha256": "complete artifact SHA-256",
      "locator": "module and examined range",
      "toolCallId": null,
      "toolName": null,
      "resultEntryId": null,
      "resultSha256": null,
      "isError": null,
      "outputExcerpted": false
    }
  ],
  "coverage": { "examined": ["update function"], "omitted": ["caller"] },
  "missing_evidence": ["Caller's retry behavior after false return."],
  "disconfirming_check": {
    "question": "Can a fresh preparation after conflict preserve both increments?",
    "method": "Inspect the declared caller and execute the two-writer schedule.",
    "result": "not-run",
    "evidence_ids": []
  }
}
```

| Field | Decision it serves |
| --- | --- |
| Version and claim identity | Link a finding, verification and synthesis without conflating different questions. |
| Question and claim | Define what would change the review decision. |
| Judgment | `supported`, `contradicted` or `unresolved` against the declared contract; never execution status. |
| Observed facts | Separate directly observed behavior from inference; every fact cites evidence IDs. |
| Assumptions | Expose premises that require confirmation rather than treating them as observations. |
| Evidence identities | Bind consumed bytes and source state; a display path or `latest` reference alone is insufficient. |
| Coverage | State examined and omitted context, including truncation and unavailable callers. |
| Missing evidence | Name the specific unresolved input and why the conclusion cannot yet follow. |
| Disconfirming check | Test an alternative explanation and preserve its outcome or absence. |

Disconfirming results are `supports`, `contradicts`, `unresolved` or `not-run`. A supported claim requires evidence sufficient for its stated scope, satisfied necessary assumptions and no unresolved decisive counterevidence. A contradicted claim needs evidence that defeats its proposition. Missing decisive context, an ambiguous contract or an exhausted request budget leaves the judgment unresolved. A successful command or valid JSON never determines claim truth.

Native evidence provenance keeps the adjacent adapter's existing names: `toolCallId`, `toolName`, `resultEntryId`, `resultSha256`, `isError` and `outputExcerpted`. Its submitted source joins unique call, result and audit records before accepting requirement assessments. `resultSha256` identifies the complete native message; `artifact_sha256` identifies independently frozen file bytes. An excerpt must not be hashed and presented as the complete result. Unknown native provenance stays null; no IDs or successful tool results are synthesized for imported file evidence. Saved verification, authorization and native execution status remain separate from claim judgment.

This comparison uses preserved submitted adapter source, not a live adapter walkthrough. Claude Code and Codex can both carry the same JSON sidecar and text uncertainty through their existing dispatch/synthesis stages. Native call/result identity is available only when the host exposes it. E2 implements immutable file retrieval; E3 implements bounded requests and disposable installed-host parity. Live native-adapter enforcement remains unqualified.

## Focused questions and bounded follow-up

The E3 implementation uses the existing packet compiler and immutable E2 archive. Supply `--review-assignments <json>` with `{schema_version:"1",assignments:[{assignment_id,reviewer,question,artifact_ids,expected_evidence}]}`. Every required specialist receives one concrete project question while retaining ordinary review duties. The compiler exposes stable source artifact IDs and the authorized inventory. Missing assignments leave legacy compilation available with `focused_questions: "not_enabled"`; they do not establish E3 enforcement.

The orchestrator starts `review-questions-cli.js` with the returned sealed evidence reference, unchanged required roster, assignments and limits. Keep the returned session reference across chunks and resumed work. Current evidence is required at session creation, request delivery, response retention and synthesis. A successful historical read cannot support a new current judgment.

Reviewers return a missing-evidence request naming their assignment, authorized artifact ID, full or line extent and why the input is decisive. Requests cannot select a path, shell command, replacement run or larger budget. Full proof must fit without truncation; line requests report neighboring context and omissions. Files absent from the frozen inventory remain unresolved until the orchestrator explicitly authorizes new evidence and reissues the affected contract.

Prospective ceilings are two requests per reviewer, four requests per review, 64 KiB per serialized response, 128 KiB total response bytes and two independent challenges. Denied and interrupted requests consume the shared allowance; restarting or rebuilding a packet does not reset it. Session records retain exact input identity, reservations and outcomes with integrity checks. Prior proof is preserved when storage limits require reconciliation.

For selected consequential questions, prepare a neutral challenge from the original change contract and authorized source before exposing peer results. Exclude the initial claim direction, verdict, severity, repair, peer identity and grader answers. Retain the actual challenge response before synthesis. Fresh prompt input separation is not OS isolation. This step preserves the existing later high-risk verification and required security/accessibility coverage.

Use the session's `response` operation to retain actual complete reviewer/challenge bytes with exact consumed artifacts, then `synthesis` to inspect current references and unresolved coverage. The helper never decides claim truth or approves a review. Missing responses, exhausted requests and decisive unknowns remain explicit. These runtime ceilings do not satisfy the frozen comparative overhead criterion; E3 stays open until the required real-PR quality and measurement evidence is complete.

### E3 implementation and real-PR checkpoint

The complete local integration suite passes 228/228 test commands after correcting two helper-inventory omissions. The implemented runtime passes 19 focused safety checks. Packet checks preserve legacy behavior and require the dedicated deep audit assignment. Both disposable installed-host walkthroughs execute the maintained request/challenge/response/synthesis pathway. These are implementation checks, distinct from observed review quality.

The bounded real-PR walkthrough reuses owned [baa-ton-forge PR #33](https://github.com/BrandedTamarasu-glitch/baa-ton-forge/pull/33), original base `f9bb8700bab14ff31dd09059250e8eae7290bbf2` and submitted head `19fb7b220115fe392301ecb6179f7478c78cff83`; its exact 17-file submitted tree was verified. All four required responses and one source challenge were retained against that evidence. The complete diff exceeded the response ceiling and stayed exhausted. A narrowed request returned complete `acceptance.js`; a conflicting request-ID replay was rejected, and a malformed request was retained as denied. Three charged requests delivered 6,121 serialized bytes. Synthesis retained the unresolved exhausted/denied states despite every required response being present.

Source review established cumulative final-phase selection for the current task and pending other-task criteria, without a reproduced selection defect or full-PR approval. Missing production wiring remained unresolved. One challenge raised a separate static confirmation-freshness question; it remains unverified and is not counted as a confirmed defect. Application source remained unchanged.

The original walkthrough used fresh prompt inputs without peer/grader results, not OS isolation. Its first challenge included a conservative pending-status guardrail and does not establish unconditioned premise discovery. A separately retained neutral follow-up received the original question, contract, complete source/test evidence and submitted diff without peer/grader conclusions or that guardrail. It independently distinguished current-task cumulative selection from pending other-task criteria, found no concrete selection defect and retained unknown native/global behavior. This supports PR-scoped independence and correct-lookalike handling; it does not qualify all frozen cases or OS isolation. Two initial protocol failures remain preserved.

A subsequent comparison was stopped after three completed arms: one matched pair and one unmatched candidate. The first pair's candidate/baseline elapsed ratio was 1.0016 and token ratio 1.0132; the unmatched candidate used 5,876,131 tokens. An additional arm was interrupted and four unstarted arms were cancelled. This falls short of the planned four pairs and establishes no median overhead qualification or general benefit. Preserve partial observations separately; do not resume that queue on a generic continuation. E3 stays unchecked. E4 depends on E2 and can proceed independently with one bounded deterministic PR preparation walkthrough.

## Frozen E1 cases

Seven local cases cover five historical situations and two correct lookalikes. Reviewer inputs are separate from the grader's key, provenance mapping and criteria. Public documentation contains no private source or trial records.

| Situation | Frozen scope and expected check | Reconstruction limit |
| --- | --- | --- |
| Unsupported assumption | Existing calibration lost-update case; distinguish an undeclared retry from an observed two-writer overwrite. | Reused synthetic code; revised prospective question. |
| Correct lookalike | Existing conditional-update case with explicitly declared fresh retry; no lost-update blocker. | Correct only under its single-threaded atomic execution model. |
| Passing test with confounded coverage | Minimal 304/MIME reconstruction; a passing known-MIME-failure assertion does not exercise the 304 classification branch. | Newly reconstructed coverage case, not an exact historical test or rescored outcome. |
| Correct branch probe | Change MIME alone to match and exercise the 304 branch; do not flag that branch as untested. | No claim about every MIME/status combination; original historical precedence remains ambiguous. |
| Successful complex review | Pinned submitted real-PR source and existing tests for acceptance assignment, provenance and save-time freshness. | Prior scoped review found no reproduced introduced violation; new supported findings require adjudication. Live hosts remain unobserved. |
| Trivial change | Exact historical documentation inventory delta and available inventory; do not invent a runtime-test blocker. | One prose change, not a complete installed inventory walkthrough. |
| Interrupted workflow | Two preserved interrupted statuses with unavailable acceptance and final responses. | Partial projection; correctness remains unresolved, no transcript or success fabricated. |

Expected checks and this table belong to preparation/grading, not reviewer prompts. Evaluated reviewers receive only their neutral case directory and question. Source tests already present in the submitted complex PR remain ordinary reviewed source; independent adjudication, peer results and later fixes stay outside that directory. File hashes cover every allowed input. Check for symlinks, unexpected files, answer-bearing variant labels and imported reports before dispatch.

The preparing supervisor can access the keys. Directory separation verifies input separation; it does not establish OS isolation, historical novelty or freedom from model contamination. Before any future model trial, export fresh case-only copies into independently restricted reviewer environments without repository history, sibling cases, grader files or shared supervisor context.

## Predeclared acceptance and overhead

Detect the targeted lost-update and coverage-confound mechanisms. Do not raise unsupported blockers on the declared-retry, corrected-probe or prose cases. Complex findings need reproducible scoped evidence; absence of a previous finding is no answer key proving the source defect-free. Interrupted correctness must remain unresolved. Require zero confirmed false blockers and no missed targeted mechanism in scored completed cases. Correctness is separate from process completion; failed/interrupted runs retain null unscored outcomes.

For future complete matched observations, enabled median elapsed time and observed tokens must each be at most 120% of baseline; the trivial case permits at most 30 seconds added elapsed time. Retain failures and incomplete pairs alongside means. Missing tokens, cost, correction time or timestamps stay unknown; overhead acceptance remains unqualified when required counters are unavailable. Do not infer cost from tokens or PR merge time. These limits are frozen before candidate observations and are not measured benefit claims.

E1 records historical current behavior and deterministic reconstruction only. No new model run or candidate response is observed. Before a future comparison, freeze exact candidate procedure, model, requested effort/settings, runtime/host, shared budgets and fresh source baselines. Existing schema 2 supplies `skill-disabled`/`skill-enabled`, balanced order and distinct actual/fixture/unobserved records; minimum four repetitions per case is a scheduling contract, not authorization to launch a batch.

## Runtime-variant assessment

Use `task-evaluation.js` unchanged for an added procedure. Shared runtime/host identity can be frozen inside its existing `settings`. Both arms must have identical model/settings/budget, and submitted trial metadata cannot gain mutable fields after scheduling.

Different runtime versions per arm are not currently a supported skill comparison. Preparation reasoning turns and repeated reads also lack summary metrics. Record these needs in a separate prospective sidecar if a future candidate requires them; then agree a compatible extension before freezing that comparison. No general runner, schema migration, scheduler or adoption default is required for E1.

## Validation checkpoint

The second preparation freeze contains seven cases and 71 reviewer files, with manifest SHA-256 `611d53ff83322fcdfdf6d05ea1838ff0cdcc2a866a7e302fd36fe09433c9b8ee`. The first copy remains preserved: independent review narrowed an overbroad coverage question, and a failed inventory check revealed selection guidance counted alongside the nine procedures. Both corrections preceded any candidate/model observation; neither historical scores nor expected source behavior changed.

Existing calibration checks execute six cases and synthetic adjudications; both reconstructed test assertions pass, exposing why exit status alone cannot establish coverage. The complex case passes 67 tests in its six-file focused suite. Existing skill-evaluation regression checks cover frozen identity, balanced scheduling, failed/missing attempts and observation separation. Input hash/isolation checks and independent contract review accompany the local record. These are preparation checks, not reviewer accuracy or runtime benefit measurements.
