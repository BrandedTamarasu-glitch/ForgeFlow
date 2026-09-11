---
name: implement
description: Run the Forgeflow in implementation mode — parallel domain-specific coding guided by the Implementation Brief
argument-hint: "[optional: path to brief or task description]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
---
<objective>
Execute parallel implementation using the Forgeflow team. Each agent writes code in their domain following the Implementation Brief produced by `/consult`. Product Lead designs validation tests in parallel. Coordinator coordinates. Architect oversees integration.

The Forgeflow team: `builder-implement`, `guardian-implement`, `designer-implement` (implementation) + `product-lead-implement` (validation tests) + `coordinator-implement` (coordination) → `architect-implement` (integration check).
</objective>

<context>
$ARGUMENTS — Optional. Can be:
- Empty: loads the brief from `.forgeflow/<project-name>/current-brief.md`
- Path to a brief file
- Task description (will run a quick inline consultation first)
</context>

<process>

## Step 1: Load the Implementation Brief and Product Lead's context

Check for existing brief and Product Lead's prior phase outputs:
```bash
PROJECT_NAME=$(basename "$(pwd)")
FORGEFLOW_DIR=".forgeflow/${PROJECT_NAME}"
BRIEF_PATH="${FORGEFLOW_DIR}/current-brief.md"
PLAN_PATH="${FORGEFLOW_DIR}/current-plan.md"
DISCUSSION_PATH="${FORGEFLOW_DIR}/current-discussion.md"
RESEARCH_PATH="${FORGEFLOW_DIR}/current-research.md"
MEMORY_CONTEXT_PATH="${FORGEFLOW_DIR}/context/implement-memory.md"
SCOPE_MANIFEST_PATH="${FORGEFLOW_DIR}/context/implement-scope-manifest.json"
NOTES_PATH="${FORGEFLOW_DIR}/implementation-notes.md"
PROJECT_LEARNINGS_PATH="${FORGEFLOW_DIR}/project-learnings.md"
LEAN_DECISION_PATH="${FORGEFLOW_DIR}/context/lean-decision.md"
LEAN_DECISION_JSON_PATH="${FORGEFLOW_DIR}/context/lean-decision.json"
HELPER_DIR="scripts/forgeflow"
SAFE_ARGS=("${ARGUMENTS:-}")
if [ ! -x "${HELPER_DIR}/build-memory-context.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/build-memory-context.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
FORGEFLOW_NODE=(env -u NODE_OPTIONS -u NODE_PATH node)

mkdir -p "$FORGEFLOW_DIR"
if [ ! -f "$NOTES_PATH" ]; then
  cat > "$NOTES_PATH" <<'EOF'
# Implementation Notes

Running notes for decisions, spec gaps, tradeoffs, deviations, follow-ups, and validation details discovered during implementation.

## At a Glance

- Artifact: .forgeflow/<project-name>/implementation-notes.md
- Format: append-only Markdown
- Owner: Coordinator serializes note candidates from implement agents; Architect verifies and may add final integration notes

## Decisions

## Spec Gaps

## Tradeoffs

## Deviations

## Follow-ups

## Validation Notes
EOF
fi

if [ -x "${HELPER_DIR}/build-memory-context.js" ]; then
  "${FORGEFLOW_NODE[@]}" "${HELPER_DIR}/build-memory-context.js" --query "${SAFE_ARGS[0]:-implementation brief validation scope interfaces}" --out "$MEMORY_CONTEXT_PATH" --json
else
  echo "Forgeflow memory helper unavailable; continue without compact memory. Run /update-forgeflow --repair if managed helpers are missing."
fi

if [ -x "${HELPER_DIR}/build-scope-manifest.js" ]; then
  "${FORGEFLOW_NODE[@]}" "${HELPER_DIR}/build-scope-manifest.js" --query "${SAFE_ARGS[0]:-implementation brief validation scope interfaces}" --out "$SCOPE_MANIFEST_PATH" --json
fi

if [ -f "$BRIEF_PATH" ] && [ -x "${HELPER_DIR}/render-lean-decision.js" ]; then
  mkdir -p "$(dirname "$LEAN_DECISION_PATH")"
  "${FORGEFLOW_NODE[@]}" "${HELPER_DIR}/render-lean-decision.js" --root "$(pwd)" --project-dir "$FORGEFLOW_DIR" --brief "$BRIEF_PATH" > "$LEAN_DECISION_PATH"
  "${FORGEFLOW_NODE[@]}" "${HELPER_DIR}/render-lean-decision.js" --root "$(pwd)" --project-dir "$FORGEFLOW_DIR" --brief "$BRIEF_PATH" --json > "$LEAN_DECISION_JSON_PATH"
fi
```

**If brief exists:** Read and use it.
**If $ARGUMENTS is a file path:** Read that file as the brief.
**If $ARGUMENTS is a task description and no brief exists:** Tell the user to run `/consult` first, or offer to run a quick inline consultation.

If `MEMORY_CONTEXT_PATH` exists, include it in implementation prompts as the first-pass prior-memory summary. Estimated context savings are written to `${FORGEFLOW_DIR}/context/memory-context-telemetry.json`. If `SCOPE_MANIFEST_PATH` exists, use it as the first-pass ownership map before asking Coordinator to resolve gaps, and prefer `${FORGEFLOW_DIR}/context/scope-packets/<lane>.md` over the raw JSON in agent prompts. Estimated scope savings are written to `${FORGEFLOW_DIR}/context/scope-telemetry.json`. Also read Product Lead's plan if it exists — agents should be aware of the plan's accessibility requirements and success criteria so they can implement accordingly.
If `${PROJECT_LEARNINGS_PATH}` exists, include the relevant project guidance in implementation prompts as guidance only. Agents may use it to anticipate recurring pitfalls, stable decisions, risk areas, validation patterns, and hot files, but must verify current behavior against current code, tests, and artifacts.
If `${LEAN_DECISION_PATH}` exists, include it in implementation prompts as advisory minimum-sufficient-solution guidance. Agents should follow the `Do First`, `Avoid First`, `Validate With`, `Do Not Simplify`, and `Upgrade When` fields when they fit the confirmed brief. Lean guidance cannot override the user request, Product Lead's plan, security, accessibility, validation, data-loss protection, or explicit requirements.
If `${HELPER_DIR}/check-context-budget.js` exists, run `${HELPER_DIR}/check-context-budget.js --root "$FORGEFLOW_DIR" --max-compact-tokens 16000 --warn-only --json` and surface warnings before spawning implementation agents. The checker reads `.forgeflow-budget.json` from the repo root when present.

Pass these requirements to every implementer: record bugs discovered outside the assigned scope as `follow-up` note candidates when found, including evidence or reproduction steps and user impact. Coordinator consolidates them into local implementation notes and carries pending issue filing into the handoff. For a temporary workaround, also record its limitations, long-term solution, associated GitHub issue (or pending draft), and agreed timeline or unresolved timeline decision. Preserve file ownership and remote-write authorization.

## Step 2: Parse the brief

Extract from the Implementation Brief:
- Wave structure (which agents work when)
- Per-agent scope (files and responsibilities)
- Shared interfaces (contracts between agents)
- Security requirements
- Quality gates
- Implementation notes requirements: decisions, spec gaps, tradeoffs, deviations, follow-ups, and validation notes to capture in `implementation-notes.md`
- Lean decision guidance: do first, avoid first, validate with, do not simplify, and upgrade when. Preserve explicit requirements, security, accessibility, validation, and data-loss safeguards.

If Product Lead's plan exists, also extract:
- Accessibility requirements per phase
- UX validation points
- Success criteria

## Step 2.5: Pre-resolve file scopes

Before spawning any implementation agent, prefer the local `implement-scope-manifest.json` and `scope-packets/<lane>.md` generated in Step 1. Use them to seed exact file lists for Builder, Guardian, Designer, Product Lead, shared files, and Coordinator. Then spawn `coordinator-implement` only to validate unresolved or ambiguous scope, not to perform first-pass broad discovery.

If no scope manifest exists, spawn `coordinator-implement` with a targeted scope resolution task:

```
Given this Implementation Brief, resolve each agent's scope into an exact file list, then read each file's contents.

Apply the security denylist before reading: exclude `.env`, `*.pem`, `*.key`, `*.p12`, `*.cert`, `*.secret`, and any file with `password`, `secret`, or `token` in the filename (case-insensitive).

For each agent (Builder, Guardian, Designer, Product Lead):
1. Use grep/glob to find files matching their scope description
2. Read each file's contents verbatim
3. Identify files appearing in 2+ agent lanes — these go into "shared"

Return a file manifest in this exact JSON structure:
{
  "shared": [
    { "path": "relative/path/to/file.ts", "content": "<verbatim file contents>" }
  ],
  "fc": [
    { "path": "relative/path/to/file.ts", "content": "<verbatim file contents>" }
  ],
  "guardian": [{ "path": "...", "content": "..." }],
  "designer": [{ "path": "...", "content": "..." }],
  "product_lead": [{ "path": "...", "content": "..." }]
}

Rules:
- "shared" key is required. Files in 2+ lanes must be promoted here and removed from individual lanes.
- If a file cannot be read: { "path": "...", "content": null, "unreadable_reason": "..." }
- Empty lane: "product_lead": [] — do not omit the key
- All paths relative to working directory

Do NOT implement anything. Scope resolution and content reading only.
```

### Phase B: Bundle Assembly

After Coordinator returns the manifest, assemble `<injected-context>` blocks without further file reads:

```xml
<injected-context>
<context-meta command="/implement" agent="{agent-name}" files="{n}" complete="{true|false}" />

IMPORTANT: All file contents below are pre-loaded by the orchestrator. Do NOT call Read, Grep, or Glob for any file already present in this block. If you encounter a reference to an unlisted file during your work, note it in your output — do not self-expand scope.

<shared-files>
<file path="{path}">
{content from manifest["shared"]}
</file>
</shared-files>

<agent-files>
<file path="{path}">
{content from manifest[lane_name]}
</file>
</agent-files>

</injected-context>
```

- `<shared-files>` uses `manifest["shared"]` — identical block for all agents
- `<agent-files>` uses `manifest[lane_name]` (fc, guardian, designer, product_lead) — unique per agent
- `complete="false"` if any entry has `content: null`
- If a manifest entry has `content: null`, log the path and include a note in the agent's prompt: "Note: [path] could not be pre-loaded — you may need to read it directly."

Use the returned manifest to include a `<file-scope>` block in every agent prompt:
```
<file-scope>
Read and modify ONLY these files:
- [list from manifest]
Files listed here that also appear in <injected-context> are pre-loaded — do not re-read them. Files listed here NOT in <injected-context> are permitted reads if you have genuine need.
</file-scope>
```

This keeps each agent's context window targeted to their domain. Agents do not explore the broader codebase.

## Step 3: Execute Wave 1 (foundations)

Spawn agents assigned to Wave 1. These typically run sequentially because later waves depend on them.

Each agent prompt must include:
- `Context is pre-loaded in <injected-context> below. Do not re-read those files.` at the top of the task description
- The assembled `<injected-context>` block for this agent (from Phase B)
- Their specific scope from the brief
- The shared interfaces they need to define or implement
- The full Implementation Brief for context
- Product Lead's accessibility requirements relevant to their scope (if plan exists)
- Instruction to commit each logical unit atomically
- Instruction to report implementation note candidates without writing the shared notes file directly
- The implementation notes path: `${NOTES_PATH}`
- Relevant project learnings from `${PROJECT_LEARNINGS_PATH}` when present, marked as guidance only
- Lean decision guidance from `${LEAN_DECISION_PATH}` when present, marked as advisory only and subordinate to the confirmed brief and hard safeguards
- Working directory path

Spawn `coordinator-implement` alongside to coordinate and track. Coordinator owns serializing note candidates into `${NOTES_PATH}` so parallel implementers do not race on the same file.

## Step 4: Verify Wave 1, spawn Wave 2

After Wave 1 completes:
1. Read the files created by Wave 1 agents
2. Hand Builder/Guardian/Designer/Product Lead/Coordinator reports from the completed wave back to `coordinator-implement` with this instruction:
   "Extract every `Implementation Notes Candidates` item from the completed agent reports. Also add concise note candidates for durable project patterns that surfaced during this wave: repeated pitfalls, stable decisions, validation patterns, hot files/modules, or follow-ups likely to matter in the next work item. When a simpler path is chosen from lean guidance, include the known ceiling and upgrade trigger as a tradeoff note. Prefer `${HELPER_DIR}/record-implementation-notes.js --lean-decision "${LEAN_DECISION_JSON_PATH}" --project-dir "${FORGEFLOW_DIR}" --json` when available, then append any additional entries under the matching category with a temporary JSON input. Do not rewrite existing notes. Then refresh `${PROJECT_LEARNINGS_PATH}` with `${HELPER_DIR}/show-project-learnings.js --project-dir "${FORGEFLOW_DIR}" --json` when the helper is available. Return the entries appended, entries rejected, final notes path, and refreshed project learnings path."
3. Verify shared interfaces were defined correctly
4. If issues found, fix before proceeding

Spawn Wave 2 agents **in parallel** — they can work simultaneously now that foundations exist.

Also spawn `product-lead-implement` in parallel with Wave 2. Product Lead designs validation tests while the implementation agents write production code. Product Lead's prompt must include:
- The full Implementation Brief
- Product Lead's plan (if it exists) — especially success criteria and accessibility requirements
- Wave 1 outputs (file paths and interfaces) so tests can reference real code
- The project's test infrastructure (Playwright installed? Jest/Vitest? Test directory conventions?)

> **File assignment constraint:** Architect's Implementation Brief must guarantee that no two agents are assigned the same file within a single wave. If two agents need to modify the same file, either sequence them across waves or have one agent own the file with the other providing requirements. Product Lead writes to the test directory only — no conflict with implementation agents. Coordinator should verify this constraint before wave execution begins.

Each Wave 2 agent prompt must include:
- `Context is pre-loaded in <injected-context> below. Do not re-read those files.` at the top of the task description
- The assembled `<injected-context>` block for this agent (from Phase B)
- Their scope from the brief
- Wave 1 outputs they depend on (exact file paths and interface definitions)
- Instruction to consume the interfaces defined in Wave 1
- Instruction to report implementation note candidates under the categories `decision`, `spec-gap`, `tradeoff`, `deviation`, `follow-up`, or `validation`

## Step 4.5: Consolidate implementation notes

After Wave 2 and Product Lead complete, hand all Wave 2 agent reports and Product Lead's validation plan to `coordinator-implement` before Architect runs:

```
Implementation note consolidation checkpoint.

Working directory: {cwd}
Implementation notes path: {notes_path}
Recorder helper: {helper_dir}/record-implementation-notes.js
Project learning recorder: {helper_dir}/record-project-learning.js
Project learnings helper: {helper_dir}/show-project-learnings.js
Project learnings path: {project_learnings_path}
Lean decision JSON path: {lean_decision_json_path}

Read the reports below, extract every `Implementation Notes Candidates` item, and append them to `{notes_path}`. Also add concise note candidates for durable project patterns that should shape the next work item: repeated pitfalls, stable decisions, validation patterns, hot files/modules, or recurring follow-ups. When a simpler path is chosen from lean guidance, include the known ceiling and upgrade trigger as a tradeoff note. Prefer the recorder helper with `--lean-decision {lean_decision_json_path}` when the JSON artifact exists, then use a temporary JSON input for additional notes. Categories must be one of: decision, spec-gap, tradeoff, deviation, follow-up, validation.

When a durable project pattern is clearer as a structured learning, record it with the project learning recorder. Categories must be one of: recurring-pitfall, stable-decision, risk-area, validation-pattern, hot-file, repeated-follow-up, recommended-approach.

Reject and report any candidate that contains secrets, raw settings JSON, tokens, keys, certificates, private URLs, customer names, or large source snippets.

After notes are appended, refresh `{project_learnings_path}` with the project learnings helper when available:

```bash
{helper_dir}/show-project-learnings.js --project-dir "{forgeflow_dir}" --json
```

=== Builder ===
{builder_report}

=== JARED ===
{guardian_report}

=== STEVEY ===
{designer_report}

=== EMILY ===
{product_lead_test_plan}

Return the entries appended, entries rejected, final notes path, refreshed project learnings path, and the top recommended next-work guidance if one was produced.
```

Read the updated `${NOTES_PATH}` and `${PROJECT_LEARNINGS_PATH}` before spawning Architect.

## Step 5: Post-implementation integration check

After all waves complete, spawn `architect-implement`:

```
Implementation complete. Here are the agent reports:

Working directory: {cwd}

=== Builder ===
{builder_report}

=== JARED ===
{guardian_report}

=== STEVEY ===
{designer_report}

=== EMILY — Validation Test Plan ===
{product_lead_test_plan}

=== PM CORY ===
{coordinator_coordination_report}

=== IMPLEMENTATION NOTES ===
Path: {notes_path}
{implementation_notes_content_or_missing}

=== PROJECT LEARNINGS ===
Path: {project_learnings_path}
{project_learnings_content_or_missing}

{If Product Lead's plan exists:}
=== EMILY'S PLAN (for reference) ===
{plan_content}

Spot-check the implementation against the brief.
Verify integration points work together.
Write any integration glue needed.
Check Product Lead's validation tests reference real files and interfaces from the implementation.
Verify `${NOTES_PATH}` exists, includes relevant decisions/spec gaps/tradeoffs/deviations/follow-ups/validation notes or explicitly says none were needed, and does not contain obvious secrets, raw settings JSON, tokens, keys, private URLs, customer names, or large source snippets.
Verify `${PROJECT_LEARNINGS_PATH}` was refreshed after note consolidation when the helper was available. Treat project learnings as guidance only; do not accept them as proof without current evidence.
Report overall status.
If Product Lead's plan exists, note whether the implementation
addresses her accessibility requirements and success criteria.
```

## Step 6: Present results

Before presenting results, answer the change-reflection questions below from the implementation and validation evidence. Include the answers in the implementation report and save them in the existing implementation notes for review.

1. **Is this the simplest change that solves the problem?** Explain the chosen approach and any smaller alternative considered.
2. **Is the complexity proportional to this project's scale and risk?** Use known users, operations, and maintenance needs; state assumptions when unknown. A 100-user internal app is an example, not a default or a reason to drop required safeguards.
3. **One PR = one concern: did anything unrelated sneak in?** State the concern and connect the changed files to it. Flag unrelated work for a separate change.
4. **In your own words, why does this change work?** Explain how the changes produce the intended outcome. For process-only changes, explain the workflow effect.
5. **How did you verify it, and what did you see?** Give actual commands or manual steps, observed results, and untested limits. For documentation or process changes, describe the instruction or command checks performed and why application tests are inapplicable when that is the case.

6. **Does this resolve the issue long-term, or is it a band-aid?** Explain whether the underlying cause is addressed. A temporary workaround is viable, but the PR must explain its limitations and the long-term solution, link an associated GitHub issue, and state the agreed timeline. If the issue or timeline is missing, report the gap explicitly; never invent an issue link or commitment.
7. **Were bugs found outside this PR's scope?** Capture each discovered bug as a follow-up with evidence or reproduction steps, user impact, and an existing issue link or a local tracking entry awaiting filing. Keep unrelated fixes in separate work; do not discard bugs because they are out of scope.
8. **How does this change affect users, and is training needed?** Describe the affected users and workflow changes. Identify required documentation, onboarding, release notes, or training and their readiness, or explain why none is needed.
9. **Do user-facing errors explain what happened and what to do next?** Check changed failure paths for clear, accurate messages and actionable recovery steps without exposing sensitive details. Cite observed behavior and untested paths, or state why this is not applicable.

Reuse existing issues where possible. Create or update GitHub issues only within current remote-write authorization. Otherwise save an actionable issue draft in local implementation notes and surface the pending filing and timeline decisions in the handoff and PR assessment; a draft does not satisfy the associated GitHub issue requirement. Missing follow-up details remain visible without introducing an automatic approval pause.

Keep answers brief and specific to the current diff. AI collaboration alone is not verification evidence. Label agent-written answers as an agent assessment; never imply a human inspected, understood, or approved the change without their input. These prompts guide reflection and do not add hooks, hard gates, or mandatory confirmation pauses.

Display the combined implementation report.

```
## Implementation Complete

{Summary of what was built by each agent}

### Change reflection
{Brief answers to the questions above, labeled as an agent assessment}

### Validation Tests Ready
{Product Lead's test plan summary — test files created, coverage matrix, manual checklists}

### Integration Status
{Architect's integration check results}

### Implementation Notes
{Path to `${NOTES_PATH}` and a short summary of notable decisions, spec gaps, tradeoffs, deviations, follow-ups, and validation notes}

### Project Learnings
{Path to `${PROJECT_LEARNINGS_PATH}` and the top recommended next-work guidance if refreshed}

### Files Created/Modified
{Combined file list — including test files}

Next: `/review` to run the full Forgeflow on these changes (Product Lead will execute her validation tests)
```

</process>

<success_criteria>
- [ ] Implementation Brief loaded and parsed
- [ ] Product Lead's plan loaded for accessibility/UX context (if it exists)
- [ ] Wave 1 agents completed and interfaces verified
- [ ] Wave 2 agents completed in parallel
- [ ] Product Lead designed validation tests in parallel with Wave 2
- [ ] Product Lead's tests map to success criteria from the plan
- [ ] Coordinator tracked coordination and persisted learnings
- [ ] Implementation notes initialized and maintained at `.forgeflow/<project-name>/implementation-notes.md`
- [ ] Project learnings refreshed after implementation note consolidation and considered as guidance when present
- [ ] Architect verified integration across agents (including test coverage)
- [ ] All code committed atomically (implementation + test files)
- [ ] Results presented with next steps
</success_criteria>


## Task evidence continuity

Use the shared task workflow for a bounded change with an accepted objective or brief. Resolve `task.js` from the same runtime helper directory used above. Run `list --root <project-root>` and reuse only the task explicitly selected by the user or matching the current objective and scope. Do not attach an unrelated task based only on recency. If this is a new accepted change, create a task using its objective and behavioral acceptance criteria; the task workflow describes the JSON contract.

Keep the same task id across consult, implement, review and ship. Use `check` for actual validation commands and saved `evidence` for observed manual/reviewer results. Record a `checkpoint` at each completed phase and before interruption, including the actual host/session identity when available. A saved plan, successful build, or reviewer verdict alone must not mark every criterion verified. Waivers require explicit user intent and a reason.

Before reporting completion or preparing a shipping handoff, read `status --root <project-root> --task <id>`. Stale/missing/failed criteria and pending actions remain visible. Reconcile interrupted actions from actual evidence, then use `resume`; never silently replay unknown work. Legacy work without task records stays supported but has no source-bound task completion claim. All remote authorization rules above still apply.

## Writing for CLI output

Apply George Orwell's six rules to progress updates, agent reports, and final summaries:

1. Never use a metaphor, simile, or other figure of speech which you are used to seeing in print.
2. Never use a long word where a short one will do.
3. If it is possible to cut a word out, always cut it out.
4. Never use the passive where you can use the active.
5. Never use a foreign phrase, a scientific word, or a jargon word if you can think of an everyday English equivalent.
6. Break any of these rules sooner than say anything outright barbarous.

Lead with the result or next action and its effect on the user's task. Match their technical background and requested detail. Explain an unfamiliar term when needed; retain precise terms for specialist reports. Use a calm, conversational voice and natural contractions. These rules take precedence over persona style and sample prose.

Use connected, short paragraphs with natural sentence variation. Use lists for steps or comparisons and headings when they help navigation. Cut repeated openings, stock transitions, rhetorical questions, forced praise, persona banter, and em dashes in prose. Warmth comes from noticing the user's actual concern and helping them act.

Progress updates should explain a finding, decision, blocker, or what the next check will resolve. Avoid narrating each tool call or repeating the plan. Ask only for information or authorization needed to proceed; explain why it matters. Final replies should stand alone: state what changed, why, what was checked, and any remaining action. Scale the detail to the task. Summarize routine checks; include tool names, versions, and internal counts only when they affect the reader's next decision. Keep validation gaps explicit.

Replace vague benefits with observable behavior. Use a brief example when it clarifies the change; label hypothetical examples. Never invent measurements, personal experiences, user reactions, test results, or approvals to make writing vivid. Keep uncertainty and failures explicit.

Preserve exact commands, code, paths, identifiers, error text, schema keys, verdict labels, and required evidence. Keep required report sections and machine-readable formats; apply style changes only to their prose. JSON-only outputs stay JSON-only. Before sending, check for awkward rhythm, repetition, unsupported claims, and whether the reader can tell what happens next. Clarity and faithful evidence are the goal; detector scores are not a quality gate.
