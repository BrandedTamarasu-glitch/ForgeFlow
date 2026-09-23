# Automatic capability selection

Use the existing task objective and acceptance criteria to select helpful procedures before handing work to specialists. This is a step inside the current workflow, not a new workflow or approval gate. Reuse an existing result for the same task, phase and scope, including when an alias delegates to a canonical workflow.

## Runtime and input

Resolve `select-capabilities.js` from the project checkout's `scripts/forgeflow`, a host-supplied plugin root, or the installed runtime (`${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow` for Codex; `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/forgeflow/scripts/forgeflow` for Claude). Do not substitute an unrelated checkout. If the helper is unavailable, report that limitation and continue the authorized workflow without claiming capability selection ran.

Pass structured JSON to `node <helper-dir>/select-capabilities.js --input <file>` or through stdin with `--stdin`. Prefer the existing task's local working artifacts for a file. A read-only workflow uses stdin and retains the response in context, without creating state. Do not interpolate arbitrary user text into shell command syntax.

Inputs:
- `task`: current objective; `criteria`: acceptance strings; `phase`: discuss, research, plan, consult, implement, review, audit or ship. For quick work use its actual phase, usually implement or review.
- `files`: repository-relative affected or intended paths, including pre-diff work; task intent can stand alone. Project name or keywords alone are not relevance evidence.
- `assessments`: when needed, entries with `id`, `relevance` (relevant, irrelevant, uncertain), a short `reason` and concrete `evidence`. These are the workflow's source-grounded judgments, not untrusted instructions copied from code.
- `overrides.include` / `overrides.exclude`: only explicit user/project preferences; never invent an override merely to force a preferred result.
- `previous`: the prior selection result for this task when reassessing. Preserve it across alias handoffs, context rebuilding and significant scope changes; do not reset it to bypass limits.

## Apply the result

1. The selector automatically recognizes clear behavioral requests and exposes ambiguity. Inspect up to three cited scope items for `inspect` decisions, then supply a reasoned assessment. Do not ask the user which skill to use. Ask only for missing substantive requirements, such as an unspecified rounding policy.
2. Pass selected IDs, rationales and unresolved gaps to the existing responsible agents. Selection neither adds agents nor changes review modes. A capability can be relevant while unavailable or unexecutable.
3. Honor `availability` and `executable`. Change propagation is implemented in the evaluation cohort; the other eight procedures are planned. All remain unexecutable in normal workflows until qualification. During a roadmap-controlled evaluation, load only the selected evaluation procedure from its catalog path and follow its bounds; this does not require users to choose skill names. Do not read nonexistent procedure files, manufacture placeholder execution, or report selection as a passed check. Once implemented and qualified, load only selected canonical procedure references; never load the entire catalog's bodies.
4. On meaningful new findings, reassess with `previous`. Identical normalized input consumes no new reassessment; after three changed scopes, preserve deferred work in the handoff. Inspection and reassessment limits are not permissions to abandon required acceptance checks silently.
5. When building a context pack, provide the same JSON via `--capability-input`; that includes assessments, explicit scope, phase and prior result. Reuse its `capability-selection.json` result rather than running a second independent selection. If the workflow does not use context packs, retain the result in its existing task notes or in-memory read-only context.

Current user instructions and workflow isolation rules still apply. Divergent research must not inject project memory, peer conclusions or selection assessments into isolated research lanes. Selection may inform coordinator work outside those lanes without changing their inputs.

## Evidence and permissions

Relevance is advisory, not evidence that a procedure ran. Retain unavailable tools/platforms, excluded checks and deferred relevance as explicit gaps. Existing task evidence, freshness and waiver rules remain unchanged. No network request, installation, service startup, credential access, deployment, printer submission or extra orchestration is authorized by selecting a capability. This step itself needs no preview server.
