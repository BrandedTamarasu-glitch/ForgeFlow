---
name: task
description: Start, inspect, validate, or resume a task with source-bound evidence
argument-hint: "start <objective> | status <id> | resume <id>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
---

Resolve runtime helpers from the checkout scripts/forgeflow, otherwise the installed ~/.claude/forgeflow/scripts/forgeflow directory. Use the user's repository root as --root. Keep task inputs local under .forgeflow/<project>/task-inputs. Never use a branch name alone as task identity.

At entry, use `node <helper-dir>/open-session-dashboard.js --root <project-root> --workflow task` when available, respecting its opt-out and session/identity checks. An unavailable dashboard does not block work. Merely inspecting a task must not report an invented implementation or completion phase.

For start, turn the user's objective into a bounded task with stable id, behavioral criteria [{id,description}], optional project-relative scope paths, and phases. Use the existing consult/implement/review workflow where appropriate. Do not add a permission pause for already authorized local work.

```bash
node scripts/forgeflow/task.js start --root . --input .forgeflow/project/task-inputs/start.json
node scripts/forgeflow/task.js status --root . --task example
node scripts/forgeflow/task.js check --root . --task example --input .forgeflow/project/task-inputs/check.json
node scripts/forgeflow/task.js checkpoint --root . --task example --input .forgeflow/project/task-inputs/checkpoint.json
node scripts/forgeflow/task.js resume --root . --task example --input .forgeflow/project/task-inputs/resume.json
```

Use a stable event_id for each operation. A check input has event_id, criterion_ids and command as an argv array. Run only validation commands needed for the user's authorized task. Check commands execute locally, with no shell expansion, but their programs retain ordinary host capabilities. Inspect untrusted commands before running them. Evidence and checkpoint results must describe what actually happened. Manual evidence requires a saved artifact and reason; waivers require an explicit user decision, and remain separate from verified checks.

Checkpoint after meaningful phases and before handing off. Include session:{host:"claude",id:<actual host session id>} when available; Codex uses host:"codex". Never invent host session IDs. Resume inspects source/evidence and refuses pending or unknown actions. It does not restore a hidden conversation or rerun commands automatically. Resolve unknown actions from observed evidence using the action operation, then use a new check event ID. recover-lock only removes a lock whose recorded writer no longer exists; never delete a live lock.

When a task is active during implement/review/ship, update its real evidence and checkpoint using the same id. Before describing the current task as complete, read status and require all criteria verified or explicitly waived and all actions reconciled. Historical verdicts do not prove current readiness. Existing artifacts without provenance remain unknown.

Optional related capabilities use the same installed runtime:

```bash
node scripts/forgeflow/task-evaluation.js plan --input trial-manifest.json
node scripts/forgeflow/task-evaluation.js summarize --input trial-results.json
node scripts/forgeflow/task-memory.js feedback --input memory-feedback.json
node scripts/forgeflow/fleet-environment.js --contract fleet-environment.json --root .
node scripts/forgeflow/task-maintenance.js --help
```

The task store is a shared module, not a second command to execute:

```text
scripts/forgeflow/task-store.js
```

Keep maintenance draft artifacts local. Commit, push, PR publication and deployment still require the user's explicit authorization under repository rules. Fixture evaluation proves instrumentation only, never real model performance or adoption.

## Writing for CLI output

Apply George Orwell's six rules to progress updates, agent reports, and final summaries:

1. Never use a metaphor, simile, or other figure of speech which you are used to seeing in print.
2. Never use a long word where a short one will do.
3. If it is possible to cut a word out, always cut it out.
4. Never use the passive where you can use the active.
5. Never use a foreign phrase, a scientific word, or a jargon word if you can think of an everyday English equivalent.
6. Break any of these rules sooner than say anything outright barbarous.

Lead with the result or action. Use short paragraphs or bullets that scan well in a terminal. Cut stock phrases, repeated summaries, and persona banter. These rules take precedence over persona style and sample prose.

Keep facts, uncertainty, risks, and required evidence intact. Preserve exact commands, code, paths, identifiers, error text, schema keys, and verdict labels. Keep required report sections and machine-readable formats; apply the rules to prose within them. Use a technical term when it is the clearest accurate choice, and explain it when needed. Before sending, cut words that add no meaning without making the result unclear or unnatural.
