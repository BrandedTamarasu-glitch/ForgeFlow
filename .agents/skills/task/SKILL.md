---
name: task
description: Start, inspect, validate, or resume a ForgeFlow task with evidence tied to its code state.
---

Resolve helpers from the checkout scripts/forgeflow first, otherwise ${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow. Work in the user's repository root. Use task.js with start|status|list|check|evidence|checkpoint|resume|action|recover-lock, --root, --task, and --input JSON as appropriate.

At workflow entry, run `node <helper-dir>/open-session-dashboard.js --root <project-root> --workflow task` when available. Respect the helper's existing opt-out, headless, identity, and session checks. An unavailable dashboard must not block the task. Opening a task view does not itself report planning, implementation, or completion; report only the phase actually performed.

Start a task from the user's objective with a stable id, objective, criteria:[{id,description}], and optional scope:[project-relative paths] and phases:[phase names]. Save inputs under .forgeflow/<project>/task-inputs. Criteria describe observable behavior and relevant accessibility. Continue the existing consult/implement/review workflows using that task ID; do not ask permission again for authorized local work.

Record meaningful phase checkpoints. Include an actual session:{host:"codex",id:<host session id>} if available; Claude uses host:"claude". Never invent session identifiers. Use a unique stable event_id per operation; repeated inputs are idempotent, conflicting reuse fails.

Use check with {event_id,criterion_ids,command:[executable,...arguments]} to capture a real validation against a stable code snapshot. Commands execute locally with normal program capabilities; inspect untrusted commands and honor host permissions. Manual evidence requires kind:"manual", status:"passed"|"failed", artifact:<saved relative path>, criterion_ids, event_id, reason. A waived criterion requires explicit user intent, a reason, and status:"waived"; never invent one to clear a blocker.

Before reporting completion, read status. Current criteria must all be verified or explicitly waived, and pending actions reconciled. Source edits, new untracked files in scope, and replaced/deleted artifacts invalidate current proof. Historical decisions remain historical. Resume reconciles source and evidence; it does not rerun commands or restore a hidden conversation. Use action with observed evidence to reconcile unknown operations before a new attempt. recover-lock removes only a demonstrably dead writer's lock, not evidence that an action ran.

When available use the read-only workshop task view. task-evaluation.js provides reproducible comparison plans and honest fixture/actual summaries. task-memory.js records task-linked feedback. fleet-environment.js validates local ownership/resource declarations. task-maintenance.js prepares bounded local repair evidence and draft handoffs. None authorizes remote publication, commits, pushes or deployment beyond the user's request. Do not represent fixture results as measured model benefit.

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
