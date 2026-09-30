# Completion comparison v3 preparation

Status: stopped after a scope correction to real GitHub PR validation. Preserve the separately frozen protocol below as historical design; do not resume this queue. [Partial outcome accounting](../../docs/completion-v3-partial-results.md) records 22 finished, two interrupted and twelve unlaunched attempts. The planned 36 workflows used the prospective protocol below. Five separate dispatch smokes remain outside comparison outcomes. F6.1 remains open and every capability remains in evaluation.

The [prospective protocol](protocol.json) specifies 36 workflows: three cases, defective and clean versions, two guidance arms and three repetitions. Pair order is balanced. Each workflow uses separate implementation, validation and integration contexts, shared 600-second initial and 360-second correction deadlines, one correction cycle, 30-second external acceptance and an 800-word limit per report. At most two workflows run concurrently.

## Cases and provenance

- **Receipt identity:** the original actual Baa-ton PR case with independently challenged [control v2](../completion-control-v2/README.md). This case is reused, not held out; 33 candidate checks and 55 existing controller tests pass.
- **[Publication reconciliation](publish-reconcile/README.md):** new authored synthetic task with canonical IDs, structural retry/conflict decisions, lost acknowledgements and concurrent publication. The clean control passes 14 checks; four incomplete repairs are rejected. Public tests pass 2/2.
- **[Migration fencing](migration-fence/README.md):** new authored synthetic task with legacy/future format behavior, stale writes, failed reload invalidation and arbitrary string dictionary keys. The clean control passes 13 checks; five incomplete repairs are rejected. Public tests pass 3/3.

The two new cases were not used in earlier studies. They are not unseen production changes or independently discovered real defects. Independent challenge found that the initial migration oracle missed loss of `__proto__` keys and malformed containers; the corrected checks and mutation controls cover these before freeze. Publication checks also cover nested collections and detached cyclic payloads.

## Local preparation

Use Linux, Git, tar, mkfifo, Python and a working Node runtime supporting `--test-isolation=none`. A source repository must contain the pinned Baa-ton commit. Preparation uses Git archives and does not edit that repository, contact services or dispatch models:

```sh
python3 scripts/forgeflow/prepare-completion-comparison.py \
  --source /path/to/baa-ton-repository \
  --output /private/comparison-v3
```

The destination must be new. Source copies and generated prompts are local-only. Trial workspaces contain the task, current source, fixed backend and public tests. Corrected reference implementations, defective reference files, private oracles and mutation metadata stay outside them. Paired inputs match byte-for-byte except treatment instructions. The ordinary selector receives task, implement phase and affected scope without include overrides or supplied relevance assessments. Its decision remains unexecutable in normal workflows; only this controlled evaluation may load the selected recovery procedure.

A local dependency failure was encountered during preparation: system Node 26.10.0 expected simdjson library ABI 33 while the installed library provided ABI 34. A matching cached library in a private runtime directory restored the original Node executable. Local schedules record the required environment and hash the executable and supplied libraries. No system package changes or ABI alias substitutions were used.

## Runner qualification and freeze boundary

The historical runner is unchanged. The new [configurable runner](../../scripts/forgeflow/run-completion-comparison.py) reuses its process supervision, event parsing and snapshot primitives, with per-case source/test profiles and strict external check identity/status verification. The 13 deterministic tests cover sequential handoffs, exact-context correction, timeouts, descendant cleanup, duplicate launch, stage boundaries, invalid oracle outputs, overlapping scope, preparation status and changed frozen inputs. These use a fake CLI and are not model outcomes.

```sh
node scripts/forgeflow/test-completion-comparison.js
```

Before freeze, independently challenge source/contracts, controls and packets, qualify a separate actual dispatch smoke, and verify paired source equality, order, scope and input hashes. Record all smoke failures as infrastructure or observed workflow failures as applicable; they are not comparison outcomes. Freeze exact source, guidance, controls, runtime, packets, settings, order and scoring before trial observations. Preparation schedules cannot launch through the ordinary runner entrypoint. A launch marker and per-slot output directories prevent silent replacement of attempts.

Four pre-freeze dispatch attempts are preserved outside the comparison denominator: session initialization failed before model work; a host attempt failed a test-write boundary and exposed long socket paths; a short-path attempt failed scratch ownership and encountered sandbox socket restrictions; the corrected socket-enabled attempt timed out during integration at 600 seconds after implementation and validation passed their tests. Packets now reserve half the remaining time for subsequent stages and prioritize reports, changes and scoped tests. These common packet changes were tuned against the reused receipt clean case in the selected arm, so that case is not independent prospective evidence. A successful smoke establishes feasibility rather than reliable completion within 600 seconds. The fifth smoke passed: three fresh contexts completed in 597.53 seconds, followed by external acceptance in 10.50 seconds. All 33 candidate checks, 55 existing controller tests and five added tests passed; source, context, report and Git boundaries passed. This establishes feasibility on the reused clean case only.

The runner owns a short /tmp directory, and packets explicitly confine scratch artifacts to that directory or handoff state. Runtime PATH is recorded. Workspace sandbox network access is enabled because the controller tests use Unix sockets; the ban on external network calls is instructional rather than network containment. No success, timing benefit or activation is inferred from preparation.

## Limits

Three evaluation stages do not establish complete production consult-to-ship qualification. Read isolation is instructional and sandbox-dependent; content checks omit permissions, Git metadata and handoff state. Final audits check HEAD, staging and source snapshots, not security containment. Synthetic stores do not prove power-loss durability, cross-process exclusion or production UI recovery. Default backend identity/settings, unexposed cost and unavailable observations remain unknown. Report every scheduled outcome and independently adjudicate consequential claims before opening arm mapping. Preserve historical reports, scores, controls and diagnostics without pooling results.
