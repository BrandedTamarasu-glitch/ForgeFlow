# Task evidence and recovery

ForgeFlow tasks connect a bounded objective to acceptance criteria, code snapshots, validation evidence, phase history, and the next action. Start with `/task` in Claude Code or `$task` in Codex. Existing consult, implement, review, and ship workflows carry the selected task forward.

The task store and dashboard are local. The dashboard reads tasks from its launched repository and never runs commands. The CLI runs only the check command explicitly supplied to it; those programs retain their ordinary host capabilities. Remote publication is a separate authorized action.

## Start and inspect

Run helpers from the checkout's `scripts/forgeflow`, or your installed host runtime's `forgeflow/scripts/forgeflow`. Pass the repository worktree root through `--root`; a Git repository with an initial commit is required. Keep input JSON under `.forgeflow/<project>/task-inputs` so it does not alter source fingerprints.

Save a start input:

```json
{
  "id": "empty-state",
  "objective": "Make the empty task list useful",
  "scope": ["src", "tests", "package.json", "package-lock.json"],
  "criteria": [
    {"id": "create", "description": "Keyboard users can open the existing Create task form"},
    {"id": "populated", "description": "Creating the first item replaces the empty state"}
  ],
  "phases": ["implement", "validate", "review"]
}
```

```bash
node scripts/forgeflow/task.js start --root . --input .forgeflow/my-project/task-inputs/start.json
node scripts/forgeflow/task.js status --root . --task empty-state
node scripts/forgeflow/task.js list --root .
```

Omit scope to include all Git-tracked and nonignored untracked paths. A scope path includes its descendants. Generated `.forgeflow` state is always excluded and evidence files are hashed separately. Include relevant configuration and dependencies when narrowing scope. A full source snapshot records HEAD, worktree identity, source content and executable modes, including deletions and new files. Symlink source entries are hashed as link text without following targets. Unsupported oversized/nonregular sources fail visibly rather than becoming verified. This includes initialized Git submodules. A narrower scope can exclude them, but then supplies no proof for their contents.

## Capture actual behavior

A check input contains command arguments, criterion IDs and a stable event ID:

```json
{
  "event_id": "empty-state-browser-1",
  "criterion_ids": ["create", "populated"],
  "command": ["npm", "run", "test:empty-state"],
  "timeout_ms": 60000
}
```

```bash
node scripts/forgeflow/task.js check --root . --task empty-state --input .forgeflow/my-project/task-inputs/check.json
```

Use a command that exists in your application. The runner records output under task-evidence, command argv, exit status, source before/after, and the artifact hash. A check that changes source cannot create fresh passing evidence. Repeating an event returns its historical result without running the command again; stale or failed results exit nonzero. Use a new event ID for a new check attempt. Concurrent starts claim an action atomically.

For an existing manual observation, `evidence` accepts `{event_id,kind:"manual",status:"passed"|"failed",criterion_ids,artifact,reason}`. This records the caller's observation, not an independently executed check. A reasoned `status:"waived"` is permitted only for explicit human waivers; the UI counts it separately from verification. Review evidence uses `kind:"review"` with the saved report. Never substitute an inferred verdict for an actual decision.

Criteria use their most recent associated evidence. Changed source or replaced artifacts produce stale evidence; deleted artifacts produce missing evidence. Historical outcomes remain intact. Older standalone telemetry without provenance is unknown. New explicit verdict telemetry adds source/artifact provenance without changing verdict totals; it does not automatically map a verdict to every task criterion.

## Checkpoint and resume

Checkpoint input: `{event_id,phase,state:"active"|"interrupted"|"complete",note,session:{host:"claude"|"codex",id}}`. The session block is optional; use only real IDs. Complete requires every criterion verified or explicitly waived and all actions reconciled.

```bash
node scripts/forgeflow/task.js checkpoint --root . --task empty-state --input .forgeflow/my-project/task-inputs/checkpoint.json
node scripts/forgeflow/task.js resume --root . --task empty-state --input .forgeflow/my-project/task-inputs/resume.json
```

Resume input is `{event_id,session?}`. It rechecks source and artifacts and explains the next action. It does not restore hidden model state or execute commands. A historically complete task becomes needs-attention if its current proof is stale.

Action input is `{event_id,action_id,status:"pending"|"unknown"|"confirmed"|"not-performed",description,evidence?}`. Confirmed and not-performed reconciliation require an evidence description. Pending or unknown actions block completion and resume. Inspect actual repository/service state before reconciling an interrupted operation.

Task mutations use an exclusive lock and atomic JSON replacement. A task record is limited to 16 MiB of serialized UTF-8 data. An update that would exceed the limit is rejected before replacement, preserving the last readable state; start a follow-up task when this limit is reached. If a writer dies holding a storage lock, `recover-lock --root . --task <id>` removes it only when the recorded process no longer exists. This does not reconcile pending actions. Malformed/live locks remain intact for inspection. State lives under `.forgeflow/<project>/tasks`; deleting it loses recovery history.

## Evaluate workflows and memory

`task-evaluation.js plan --input <manifest.json>` produces seeded balanced schedules across no-agent, single-agent and ForgeFlow arms. The manifest supplies seed, baseline, tasks, repetitions and arm model/settings/budget metadata. `summarize --input <results.json>` separates fixture from actual trials, preserves missing measurements and unobserved regressions, and reports descriptive comparisons only. The CLI does not invoke paid models. See the module's `planTrials` input validation for the complete contract and [Workflow Comparison](Workflow-Comparison.md).

Project-learning candidates may now supply `dependencies` and `evidence_refs` as project-relative path arrays. Their scoped content/artifact provenance is captured at recording. Live retrieval suppresses changed dependencies, replaced/missing evidence and contradicted learnings even when an old index is loaded. Unrelated source changes preserve scoped memory; legacy candidates remain unknown rather than acquiring invented provenance.

Use `task-memory.js feedback --input <json>` with root, projectDir, taskId, learningId and outcome used/ignored/contradicted/corrected. IDs must refer to real tasks and learnings; correction requires a real replacement. Use does not imply usefulness. Existing stale/superseded/conflict controls remain in force.

## Fleet and maintenance

`fleet-environment.js --contract <json> --root .` validates worktree ownership, pinned starting commits, unique ports and resource names, and actual committed/staged/unstaged/untracked changes. Each Git layer is inspected independently, so restoring working-tree bytes cannot hide an unowned staged edit. It does not reserve ports or provision infrastructure. See [fleet command](../../commands/fleet.md). Failure preserves the workspace for inspection.

`task-maintenance.js ingest --root . --input <event.json>` accepts repository_root, run_id, attempt, log_file, command argv and max_attempts (1–5). The caller must supply a real failed-CI log. It saves a failure digest and deduplicates by repository/run/attempt. It does not subscribe to webhooks.

`repair --root . --task <ci-id> --input <proposal-input.json>` accepts proposal_file referring to an existing bounded deterministic replace proposal. Source must still match, embedded validation commands are rejected, and the original event's explicit CI command is run after repair. Attempts are bounded and uncertain effects require reconciliation. `validate` resumes validation of an already applied, reconciled repair; it does not reapply the patch. `prepare` produces local draft Markdown/JSON from current passing evidence. No PR is created. `status`, `reconcile`, and `recover-lock` expose recovery steps.

## Validation boundary

Regression fixtures exercise freshness, atomic/idempotent updates, interruption recovery, installed host paths, live concurrent services, memory suppression, and a real local repair/check/draft sequence. Browser tests cover task states, keyboard controls, narrow screens, unsafe text and refresh failures. These demonstrate implementation behavior; they do not establish real-world agent performance or user adoption.
