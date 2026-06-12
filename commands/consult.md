---
name: consult
description: Run the Forgeflow in consultation mode — design the approach before writing code
argument-hint: "<description of what to build>"
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
Run the Forgeflow team in consultation mode before implementation begins. Each agent analyzes the task from their specialty, then Arbiter synthesizes an Implementation Brief that guides parallel implementation. If Compass's plan exists from a prior `/plan` run, it serves as the input for consultation.

The Forgeflow team: `smith-consult`, `warden-consult`, `lumen-consult`, `atlas-consult` (parallel) → `arbiter-consult` (synthesis).

> **Recommended flow:** `/discuss` → `/research` → `/plan` → `/consult` → `/implement` → `/review`
> You can skip directly to `/consult` for smaller tasks, but the full flow produces better outcomes.
</objective>

<context>
$ARGUMENTS — Description of what to build. Can be:
- Freeform text: "Add user authentication with OAuth"
- File reference: "implement the changes described in docs/spec.md"
- Task reference: "the feature from issue #42"
- Empty: if Compass's plan exists at `.forgeflow/<project-name>/current-plan.md`, use that as input

$ARGUMENTS is provided by the user after the slash command (e.g., `/consult Add user auth`). The command runner injects it as the argument string.
</context>

<process>

## Step 1: Gather context

**Check for CONTEXT.md files first** — these are pre-written service summaries that replace broad exploration:
```bash
find . -name "CONTEXT.md" -not -path "*/node_modules/*" -not -path "*/.planning/*"
```
If found, read them. Pass their content directly to consultation agents instead of having agents glob/read widely. CONTEXT.md files contain: architecture overview, file list, key state, protocols, and constraints.

If no CONTEXT.md exists, read relevant files to understand the current codebase state:
- Project structure (key directories, entry points)
- Existing patterns (how similar features are currently implemented)
- Database schema if relevant
- Frontend component structure if relevant

Also check for Compass's prior phase outputs:
```bash
PROJECT_NAME=$(basename "$(pwd)")
FORGEFLOW_DIR=".forgeflow/${PROJECT_NAME}"
PLAN_PATH="${FORGEFLOW_DIR}/current-plan.md"
DISCUSSION_PATH="${FORGEFLOW_DIR}/current-discussion.md"
RESEARCH_PATH="${FORGEFLOW_DIR}/current-research.md"
MEMORY_CONTEXT_PATH="${FORGEFLOW_DIR}/context/consult-memory.md"
SCOPE_MANIFEST_PATH="${FORGEFLOW_DIR}/context/consult-scope-manifest.json"
NOTES_PATH="${FORGEFLOW_DIR}/implementation-notes.md"
PROJECT_LEARNINGS_PATH="${FORGEFLOW_DIR}/project-learnings.md"
LEAN_DECISION_PATH="${FORGEFLOW_DIR}/context/lean-decision.md"
LEAN_DECISION_JSON_PATH="${FORGEFLOW_DIR}/context/lean-decision.json"
HELPER_DIR="scripts/forgeflow"
SAFE_ARGS=("${ARGUMENTS:-}")
FORGEFLOW_NODE=(env -u NODE_OPTIONS -u NODE_PATH node)
if [ ! -x "${HELPER_DIR}/build-memory-context.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/build-memory-context.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi

if [ -x "${HELPER_DIR}/build-memory-context.js" ]; then
  "${FORGEFLOW_NODE[@]}" "${HELPER_DIR}/build-memory-context.js" --query "${SAFE_ARGS[0]:-consult implementation brief architecture security frontend coordination}" --out "$MEMORY_CONTEXT_PATH" --json
else
  echo "Forgeflow memory helper unavailable; continue without compact memory. Run /update-forgeflow --repair if managed helpers are missing."
fi

if [ -x "${HELPER_DIR}/build-scope-manifest.js" ]; then
  "${FORGEFLOW_NODE[@]}" "${HELPER_DIR}/build-scope-manifest.js" --query "${SAFE_ARGS[0]:-consult implementation brief architecture security frontend coordination}" --out "$SCOPE_MANIFEST_PATH" --json
fi

if [ -x "${HELPER_DIR}/render-lean-decision.js" ]; then
  mkdir -p "$(dirname "$LEAN_DECISION_PATH")"
  "${FORGEFLOW_NODE[@]}" "${HELPER_DIR}/render-lean-decision.js" --root "$(pwd)" --project-dir "$FORGEFLOW_DIR" --task "${SAFE_ARGS[0]:-consult implementation brief architecture security frontend coordination}" > "$LEAN_DECISION_PATH"
  "${FORGEFLOW_NODE[@]}" "${HELPER_DIR}/render-lean-decision.js" --root "$(pwd)" --project-dir "$FORGEFLOW_DIR" --task "${SAFE_ARGS[0]:-consult implementation brief architecture security frontend coordination}" --json > "$LEAN_DECISION_JSON_PATH"
fi
```

If `MEMORY_CONTEXT_PATH` exists, use it as the first-pass memory summary for all consultation agents. Estimated context savings are written to `${FORGEFLOW_DIR}/context/memory-context-telemetry.json`. If `current-plan.md` exists, read it — this is Compass's implementation plan and should serve as the primary input for consultation. Read discussion and research files only when the memory summary is insufficient or exact source text is needed.
If `${NOTES_PATH}` exists, treat it as local implementation history. Use it to identify prior decisions, spec gaps, tradeoffs, deviations, follow-ups, and validation notes that should shape the new brief. Do not copy raw notes into the brief unless they are directly relevant.
If `${PROJECT_LEARNINGS_PATH}` exists, treat it as durable project guidance for recurring pitfalls, stable decisions, risk areas, validation patterns, hot files/modules, repeated follow-ups, and recommended next approach. It is guidance only, not proof; verify against current code, tests, and artifacts.
If `${LEAN_DECISION_PATH}` exists, include it as compact advisory minimum-sufficient-solution guidance. The Implementation Brief should include a `## Lean Decision` section with `Do First`, `Avoid First`, `Validate With`, `Do Not Simplify`, and `Upgrade When` fields. Lean guidance cannot override the user request, Compass's plan, security, accessibility, validation, data-loss protection, or explicit requirements.
If `SCOPE_MANIFEST_PATH` exists, use it as the first-pass file ownership map. Prefer the matching `${FORGEFLOW_DIR}/context/scope-packets/<lane>.md` packet for each agent prompt, and read only the files listed for each lane unless the packet marks a gap or an agent needs a precise extra source line. Estimated scope savings are written to `${FORGEFLOW_DIR}/context/scope-telemetry.json`.
If `${HELPER_DIR}/check-context-budget.js` exists, run `${HELPER_DIR}/check-context-budget.js --root "$FORGEFLOW_DIR" --max-compact-tokens 16000 --warn-only --json` and surface warnings before spawning agents. The checker reads `.forgeflow-budget.json` from the repo root when present.

## Step 1.5: Context Pre-Loading

Apply the security denylist before reading any file: exclude `.env`, `*.pem`, `*.key`, `*.p12`, `*.cert`, `*.secret`, and any file with `password`, `secret`, or `token` in the filename (case-insensitive).

**Discover:** CONTEXT.md files (from Step 1) + Compass's plan/discussion/research files (from Step 1) + `SCOPE_MANIFEST_PATH` and `scope-packets/<lane>.md` when present.

**Resolve:** Prefer `SCOPE_MANIFEST_PATH` when present. Otherwise split by agent domain using these heuristics:
- Smith → data layer, service, business logic, model files
- Warden → auth, API, validation, security-related files
- Lumen → frontend, component, stylesheet files
- Atlas → `.forgeflow/` Forgeflow dir contents

Files needed by 2+ agent domains → `<shared-files>`. Files needed by one domain → that agent's `<agent-files>`.

**Read:** Read all resolved files into orchestrator context (one pass, after denylist filter).

**Bundle:** Assemble per-agent `<injected-context>` blocks using this canonical format:
```xml
<injected-context>
<context-meta command="/consult" agent="{agent-name}" files="{n}" complete="{true|false}" />

IMPORTANT: All file contents below are pre-loaded by the orchestrator. Do NOT call Read, Grep, or Glob for any file already present in this block. If you encounter a reference to an unlisted file during your work, note it in your output — do not self-expand scope.

<shared-files>
<file path="path/to/shared-file.ts">
[file contents verbatim]
</file>
</shared-files>

<agent-files>
<file path="path/to/agent-specific-file.ts">
[file contents verbatim]
</file>
</agent-files>

</injected-context>
```

## Step 2: Initialize Atlas's persistent storage

```bash
mkdir -p "${FORGEFLOW_DIR}/agent-notes"
```

## Step 3: Spawn consultation agents in parallel

Spawn `smith-consult`, `warden-consult`, `lumen-consult`, `atlas-consult` in parallel using the Agent tool. Lumen always participates (connectivity hat always on; frontend hat activates when frontend is in scope).

Each agent prompt must include:
- The task description ($ARGUMENTS) — or Compass's plan if it exists
- If Compass's plan exists, include it verbatim and instruct agents to consult against the plan's requirements, accessibility checklist, and scope boundaries
- CONTEXT.md content (if found in Step 1) — passed verbatim so agents don't need to re-read service files
- Relevant codebase context (file structure, existing patterns) — only if CONTEXT.md not available
- Working directory path
- A `<file-scope>` block listing the files each agent should focus on (derived from `scope-packets/<lane>.md`, `consult-scope-manifest.json`, CONTEXT.md file lists, or grep/glob pre-resolution):

Each agent prompt must also begin with: `Context is pre-loaded in <injected-context> below. Do not re-read those files.`

Inject the assembled `<injected-context>` block (from Step 1.5) into each agent prompt.

```
<file-scope>
Read and modify ONLY these files:
- [list of files relevant to this agent's domain]
Files listed here that also appear in <injected-context> are pre-loaded — do not re-read them. Files listed here NOT in <injected-context> are permitted reads if you have genuine need.
</file-scope>
```

For `atlas-consult`, include the FORGEFLOW_DIR path for loading persistent context.

## Step 4: Spawn Arbiter

After all consultation agents complete, spawn `arbiter-consult` with all their briefs:

```
You are consulting on: $ARGUMENTS

Working directory: {cwd}

{If Compass's plan exists:}
Compass's Implementation Plan (from /discuss → /research → /plan):
{plan_content}

Compass's Research Findings:
{research_content (if available)}

Here are the consultation briefs from your Forgeflow:

=== Smith — Architecture Brief ===
{smith_output}

=== JARED — Systems & Security Brief ===
{warden_output}

=== STEVEY — Design & Connectivity Brief ===
{lumen_output}

=== PM CORY — Consultation Notes ===
{atlas_output}

Produce the Implementation Brief. Resolve any conflicts between agents.
Lock down shared interfaces. Define the implementation waves.
If Compass's plan exists, ensure the brief aligns with her requirements,
accessibility checklist, and scope boundaries. Note any deviations.
Include an Implementation Notes Requirements section that tells `/implement`
what decisions, spec gaps, tradeoffs, deviations, follow-ups, and validation
notes must be captured in `${FORGEFLOW_DIR}/implementation-notes.md`.
When project learnings exist, include the relevant guidance and state that each
item must be re-verified against current code, tests, and artifacts.
When lean decision guidance exists, include a `## Lean Decision` section with
`Do First`, `Avoid First`, `Validate With`, `Do Not Simplify`, and `Upgrade When`
fields. State that lean guidance is advisory and cannot remove explicit
requirements, security, accessibility, validation, or data-loss safeguards.
```

## Step 5: Present the Implementation Brief

Display Arbiter's Implementation Brief to the user.

Save a copy to `.forgeflow/<project-name>/current-brief.md` for reference during implementation.

```
## Implementation Brief Ready

{Arbiter's brief}

Next: `/implement` to execute this brief with the Forgeflow team
Or: modify the brief and then run `/implement`
```

</process>

<success_criteria>
- [ ] Compass's prior phase outputs loaded if they exist
- [ ] Codebase context gathered
- [ ] All consultation agents completed their briefs
- [ ] Arbiter produced a unified Implementation Brief
- [ ] Brief aligns with Compass's plan (if it exists)
- [ ] Shared interfaces defined with exact signatures
- [ ] Scope divided cleanly between agents
- [ ] Implementation waves defined
- [ ] Brief saved to .forgeflow/ for reference
</success_criteria>
