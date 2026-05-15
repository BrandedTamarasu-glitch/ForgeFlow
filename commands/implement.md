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
```bash
source "$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel 2>/dev/null)/services/chat-bridge/init-session.sh" "implement" "$*"
```
<objective>
Execute parallel implementation using the Forgeflow team. Each agent writes code in their domain following the Implementation Brief produced by `/consult`. Compass designs validation tests in parallel. Atlas coordinates. Arbiter oversees integration.

The Forgeflow team: `smith-implement`, `warden-implement`, `lumen-implement` (implementation) + `compass-implement` (validation tests) + `atlas-implement` (coordination) → `arbiter-implement` (integration check).
</objective>

<context>
$ARGUMENTS — Optional. Can be:
- Empty: loads the brief from `.forgeflow/<project-name>/current-brief.md`
- Path to a brief file
- Task description (will run a quick inline consultation first)
</context>

<process>

## Step 1: Load the Implementation Brief and Compass's context

Check for existing brief and Compass's prior phase outputs:
```bash
PROJECT_NAME=$(basename "$(pwd)")
FORGEFLOW_DIR=".forgeflow/${PROJECT_NAME}"
BRIEF_PATH="${FORGEFLOW_DIR}/current-brief.md"
PLAN_PATH="${FORGEFLOW_DIR}/current-plan.md"
DISCUSSION_PATH="${FORGEFLOW_DIR}/current-discussion.md"
RESEARCH_PATH="${FORGEFLOW_DIR}/current-research.md"
MEMORY_CONTEXT_PATH="${FORGEFLOW_DIR}/context/implement-memory.md"
SCOPE_MANIFEST_PATH="${FORGEFLOW_DIR}/context/implement-scope-manifest.json"

if [ -x "scripts/forgeflow/build-memory-context.js" ]; then
  scripts/forgeflow/build-memory-context.js --query "${ARGUMENTS:-implementation brief validation scope interfaces}" --out "$MEMORY_CONTEXT_PATH" --json
fi

if [ -x "scripts/forgeflow/build-scope-manifest.js" ]; then
  scripts/forgeflow/build-scope-manifest.js --query "${ARGUMENTS:-implementation brief validation scope interfaces}" --out "$SCOPE_MANIFEST_PATH" --json
fi
```

**If brief exists:** Read and use it.
**If $ARGUMENTS is a file path:** Read that file as the brief.
**If $ARGUMENTS is a task description and no brief exists:** Tell the user to run `/consult` first, or offer to run a quick inline consultation.

If `MEMORY_CONTEXT_PATH` exists, include it in implementation prompts as the first-pass prior-memory summary. Estimated context savings are written to `${FORGEFLOW_DIR}/context/memory-context-telemetry.json`. If `SCOPE_MANIFEST_PATH` exists, use it as the first-pass ownership map before asking Atlas to resolve gaps, and prefer `${FORGEFLOW_DIR}/context/scope-packets/<lane>.md` over the raw JSON in agent prompts. Estimated scope savings are written to `${FORGEFLOW_DIR}/context/scope-telemetry.json`. Also read Compass's plan if it exists — agents should be aware of the plan's accessibility requirements and success criteria so they can implement accordingly.
If `scripts/forgeflow/check-context-budget.js` exists, run `scripts/forgeflow/check-context-budget.js --root "$FORGEFLOW_DIR" --max-compact-tokens 16000 --warn-only --json` and surface warnings before spawning implementation agents.

## Step 2: Parse the brief

Extract from the Implementation Brief:
- Wave structure (which agents work when)
- Per-agent scope (files and responsibilities)
- Shared interfaces (contracts between agents)
- Security requirements
- Quality gates

If Compass's plan exists, also extract:
- Accessibility requirements per phase
- UX validation points
- Success criteria

## Step 2.5: Pre-resolve file scopes

Before spawning any implementation agent, prefer the local `implement-scope-manifest.json` and `scope-packets/<lane>.md` generated in Step 1. Use them to seed exact file lists for Smith, Warden, Lumen, Compass, shared files, and Atlas. Then spawn `atlas-implement` only to validate unresolved or ambiguous scope, not to perform first-pass broad discovery.

If no scope manifest exists, spawn `atlas-implement` with a targeted scope resolution task:

```
Given this Implementation Brief, resolve each agent's scope into an exact file list, then read each file's contents.

Apply the security denylist before reading: exclude `.env`, `*.pem`, `*.key`, `*.p12`, `*.cert`, `*.secret`, and any file with `password`, `secret`, or `token` in the filename (case-insensitive).

For each agent (Smith, Warden, Lumen, Compass):
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
  "warden": [{ "path": "...", "content": "..." }],
  "lumen": [{ "path": "...", "content": "..." }],
  "compass": [{ "path": "...", "content": "..." }]
}

Rules:
- "shared" key is required. Files in 2+ lanes must be promoted here and removed from individual lanes.
- If a file cannot be read: { "path": "...", "content": null, "unreadable_reason": "..." }
- Empty lane: "compass": [] — do not omit the key
- All paths relative to working directory

Do NOT implement anything. Scope resolution and content reading only.
```

### Phase B: Bundle Assembly

After Atlas returns the manifest, assemble `<injected-context>` blocks without further file reads:

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
- `<agent-files>` uses `manifest[lane_name]` (fc, warden, lumen, compass) — unique per agent
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
- Compass's accessibility requirements relevant to their scope (if plan exists)
- Instruction to commit each logical unit atomically
- Working directory path

Spawn `atlas-implement` alongside to coordinate and track.

## Step 4: Verify Wave 1, spawn Wave 2

After Wave 1 completes:
1. Read the files created by Wave 1 agents
2. Verify shared interfaces were defined correctly
3. If issues found, fix before proceeding

Spawn Wave 2 agents **in parallel** — they can work simultaneously now that foundations exist.

Also spawn `compass-implement` in parallel with Wave 2. Compass designs validation tests while the implementation agents write production code. Compass's prompt must include:
- The full Implementation Brief
- Compass's plan (if it exists) — especially success criteria and accessibility requirements
- Wave 1 outputs (file paths and interfaces) so tests can reference real code
- The project's test infrastructure (Playwright installed? Jest/Vitest? Test directory conventions?)

> **File assignment constraint:** Arbiter's Implementation Brief must guarantee that no two agents are assigned the same file within a single wave. If two agents need to modify the same file, either sequence them across waves or have one agent own the file with the other providing requirements. Compass writes to the test directory only — no conflict with implementation agents. Atlas should verify this constraint before wave execution begins.

Each Wave 2 agent prompt must include:
- `Context is pre-loaded in <injected-context> below. Do not re-read those files.` at the top of the task description
- The assembled `<injected-context>` block for this agent (from Phase B)
- Their scope from the brief
- Wave 1 outputs they depend on (exact file paths and interface definitions)
- Instruction to consume the interfaces defined in Wave 1

## Step 5: Post-implementation integration check

After all waves complete, spawn `arbiter-implement`:

```
Implementation complete. Here are the agent reports:

Working directory: {cwd}

=== Smith ===
{smith_report}

=== JARED ===
{warden_report}

=== STEVEY ===
{lumen_report}

=== EMILY — Validation Test Plan ===
{compass_test_plan}

=== PM CORY ===
{atlas_coordination_report}

{If Compass's plan exists:}
=== EMILY'S PLAN (for reference) ===
{plan_content}

Spot-check the implementation against the brief.
Verify integration points work together.
Write any integration glue needed.
Check Compass's validation tests reference real files and interfaces from the implementation.
Report overall status.
If Compass's plan exists, note whether the implementation
addresses her accessibility requirements and success criteria.
```

## Step 6: Present results

Display the combined implementation report.

```
## Implementation Complete

{Summary of what was built by each agent}

### Validation Tests Ready
{Compass's test plan summary — test files created, coverage matrix, manual checklists}

### Integration Status
{Arbiter's integration check results}

### Files Created/Modified
{Combined file list — including test files}

Next: `/review` to run the full Forgeflow on these changes (Compass will execute her validation tests)
```

</process>

<success_criteria>
- [ ] Implementation Brief loaded and parsed
- [ ] Compass's plan loaded for accessibility/UX context (if it exists)
- [ ] Wave 1 agents completed and interfaces verified
- [ ] Wave 2 agents completed in parallel
- [ ] Compass designed validation tests in parallel with Wave 2
- [ ] Compass's tests map to success criteria from the plan
- [ ] Atlas tracked coordination and persisted learnings
- [ ] Arbiter verified integration across agents (including test coverage)
- [ ] All code committed atomically (implementation + test files)
- [ ] Results presented with next steps
</success_criteria>
