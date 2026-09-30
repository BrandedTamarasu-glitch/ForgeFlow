# Completion qualification control v2

Status: prepared and independently challenged candidate, 2026-09-30. [Candidate identity and limits](candidate.json). This fixture authorizes no model dispatch. A later separately frozen comparison was stopped; its partial outcomes are preserved separately. No comparison is running. F6.1 and normal activation remain open. Historical [pilot](../completion-pilot/README.md), [automated results](../../docs/completion-auto-results.md), protocols, oracles and post-observation diagnostics remain separate and unchanged.

## Reproduce

Use a source repository containing Baa-ton PR #6 head `2bbb198b7a5852cd64fc243a1392cda56f517640`, Linux, `mkfifo`, Node supporting `--test-isolation=none`, Git and tar:

```sh
node fixtures/completion-control-v2/validate.mjs /path/to/baa-ton-repository
```

The validator archives that exact commit into an owned disposable directory, applies [control.patch](control.patch), and imports its actual controller through the [v2 oracle](acceptance.mjs). It never edits the supplied checkout, installs dependencies, contacts a service, or sends a live native prompt. Existing controller tests use disposable local Unix sockets; restricted hosts may need native permission to run them. Temporary source is removed after validation. The stdout summary reports actual check results; retain it locally when needed.

## Evidence and contract

The candidate passes the original 21 checks, all 33 v2 checks, and the unchanged 55-test controller suite. The submitted PR remains 19/21 under the original oracle. Five deliberate incomplete repairs are rejected: accepting malformed direct ID equality, dropping legacy UUID compatibility, dropping canonical aliases, accepting foreign session headers, and losing the persisted pre-send claim. These deterministic challenges are not model trials or a measured false-positive rate.

The twelve new cases cover a path incorrectly tagged as a Pi ID, matching and foreign canonical path aliases, exact native path metadata without a local file, malformed IDs, foreign and unknown-kind legacy bindings, uppercase valid legacy UUID bindings, an oversized header, a mismatched header ID, legacy busy-to-ready recovery, and rejection of a FIFO binding without blocking. Existing checks retain readiness/ownership/incarnation vetoes, concurrent and repeated ticks, pre-send publication and no replay of sending/uncertain/delivered states.

Exact native path equality preserves the existing controller contract without requiring a local file. Unequal path metadata must resolve to the same regular file. Pi IDs must match the existing native UUID syntax; legacy UUID bindings compare directly, while canonical file bindings use the bounded first session-header line. The descriptor is opened nonblocking and checked for a regular file before reading; a FIFO cannot hold the manifest lock waiting for a writer. Non-Pi metadata retains direct comparison and does not read Pi headers. Filename similarity is never identity proof.

An early candidate incorrectly required every exact native path to exist. Three unchanged controller tests rejected that regression. The candidate now preserves exact path compatibility; the new control does not redefine the historical contract to hide failing tests.

## Selection and stage budget

The original completion task now selects persistence recovery through the ordinary selector and context preparation without include overrides or supplied relevance assessments. Regression checks cover implementation/review phases and exclude spelling-only or explicitly out-of-scope requests. The result remains `availability: evaluation`, `executable: false`; routing is not activation or a completed agent workflow.

Recovery guidance now prioritizes the changed mechanism, compatibility, the durable pre-send claim, retry and no replay, while reserving stage time for regressions and handoff. Broader storage schedules require affected source. Unrun acceptance remains pending. This guidance has not been timed in a new comparison and establishes no benefit under the 600-second initial or 360-second correction budgets.

An independent challenge reproduced a blocking FIFO open in the first candidate; the corrected nonblocking open now passes the added regression. Before any separately frozen comparison, identify varied held-out cases and qualify the supported workflow. Freeze source, control, revised guidance, settings, schedule, deadlines and scoring before observations. Preserve every earlier score and diagnostic; do not rerun completed queues. No new study is launched by this preparation.
