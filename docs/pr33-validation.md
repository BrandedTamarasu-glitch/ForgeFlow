# Real-PR validation: scoped acceptance

Date: 2026-09-30. **Focused review complete; no introduced defect reproduced in the reviewed paths.** This is one source review with executable checks, not a repeated capability comparison or live runtime qualification.

The change is [baa-ton-forge PR #33](https://github.com/BrandedTamarasu-glitch/baa-ton-forge/pull/33), “Scope acceptance validation by task and integration phase.” Head is `19fb7b220115fe392301ecb6179f7478c78cff83`; base and verified merge base are `f9bb8700bab14ff31dd09059250e8eae7290bbf2`. Review used a disposable checkout of the submitted head and its base diff. Application source remained unchanged and the checkout remained clean.

## Reviewed behavior

The review followed acceptance assignments through brief parsing, guided setup, legacy session adoption, verification guidance, evidence drafts, save confirmation, integration prerequisites and audit output.

- Every normalized acceptance criterion must have exactly one assignment to existing tasks. Missing, duplicate and invented requirement IDs, unknown fields and empty task assignments are rejected. File scope inspection and declared checks remain required.
- Pre-integration criteria are cumulative at final verification. Later-phase and other-task criteria remain visible as pending; the current task does not mark them passed.
- Legacy adoption requires owning-root proof and native confirmation. The proposal and confirmed scope are bound to the original brief snapshot and root/session/pane/workspace. Existing blocked drafts and receipts remain historical. Active handoffs, foreign mappings, changed snapshots and late rescoping are rejected.
- Scope and pending requirements participate in verification fingerprints. Save-time checks rebuild the draft before and after confirmation. Altered scope/evidence, missing assessments and failed results cannot produce an eligible saved draft. Scoped tasks reject direct verification and require fresh final evidence after pre-integration validation.

No suspected introduced violation survived the source and executable checks, so there is no defect reproduction to attribute against the base. Absence of a confirmed finding is not proof that the PR is defect-free.

## Validation

The following focused command passes **67/67 tests** across six existing test files:

```sh
node --test --test-isolation=none test/acceptance.test.js test/verification-handoff.test.js test/integration.test.js test/task-setup.test.js test/repositories.test.js test/installation.test.js
```

Coverage includes real disposable Git checkouts, declared/session scopes, native confirmation fixtures, fresh final handoffs, direct-verification rejection, evidence tampering and legacy behavior. An initial sandbox run failed the CLI child-process test with empty JSON output; the host rerun passed. This is an execution-environment observation, not a reproduced PR defect.

A separate local challenge exercised all 144 combinations of two criteria across permitted task assignments, phases and validation contexts. Every criterion appeared exactly once as applicable or pending with unchanged text. Four altered-provenance cases were rejected, and four changes to scope, pending criteria or applicable text changed the verification fingerprint. These are deterministic source checks, not model workflows or measured accuracy.

## Limits and next action

Live Pi/Herdr ownership and confirmation, actual dispatched work, Windows behavior and complete production integration remain unverified. The entire upstream test suite was not rerun; these checks target the selected change. No application edits, commits, pushes or GitHub comments were made.

F6.1 and normal capability activation remain open. Retain this result separately from historical studies and the stopped synthetic comparison. The next qualification step is a bounded real-PR or live-host check addressing a specific remaining gap; no further model batch is scheduled.
