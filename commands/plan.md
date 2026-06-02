---
name: plan
description: Run the Forgeflow in planning mode — create a structured implementation plan from discussion and research
argument-hint: "[optional: path to research findings or specific planning constraints]"
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
Run Compass and Atlas in planning mode to create a structured implementation plan that guides the technical consultation phase.

The planning team:
1. **Compass** (`compass-plan`) — Plan structure, scope definition, accessibility integration, UX milestones, success validation
2. **Atlas** (`atlas-early`) — Scope validation, coordination risk identification, memory persistence
</objective>

<context>
$ARGUMENTS — Optional. Can be:
- Empty: loads discussion and research from `.forgeflow/<project-name>/`
- Path to research findings
- Specific planning constraints

$ARGUMENTS is provided by the user after the slash command (e.g., `/plan` or `/plan Must ship by Friday`). The command runner injects it as the argument string.
</context>

<process>

## Step 0: Context Pre-Loading

Apply the security denylist before reading any file: exclude `.env`, `*.pem`, `*.key`, `*.p12`, `*.cert`, `*.secret`, and any file with `password`, `secret`, or `token` in the filename (case-insensitive).

Build compact local memory context before reading phase files directly:
```bash
PROJECT_NAME=$(basename "$(pwd)")
FORGEFLOW_DIR=".forgeflow/${PROJECT_NAME}"
MEMORY_CONTEXT_PATH="${FORGEFLOW_DIR}/context/plan-memory.md"
HELPER_DIR="scripts/forgeflow"
SAFE_ARGS=("${ARGUMENTS:-}")
FORGEFLOW_NODE=(env -u NODE_OPTIONS -u NODE_PATH node)
if [ ! -x "${HELPER_DIR}/build-memory-context.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/build-memory-context.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ -x "${HELPER_DIR}/build-memory-context.js" ]; then
  "${FORGEFLOW_NODE[@]}" "${HELPER_DIR}/build-memory-context.js" --query "${SAFE_ARGS[0]:-planning scope dependencies risks accessibility}" --out "$MEMORY_CONTEXT_PATH" --json
else
  echo "Forgeflow memory helper unavailable; continue without compact memory. Run /update-forgeflow --repair if managed helpers are missing."
fi
```

If `MEMORY_CONTEXT_PATH` exists, inject it into Compass and Atlas as the memory summary. Read full phase files only when the summary cites a gap or exact source text is needed. Estimated context savings are written to `${FORGEFLOW_DIR}/context/memory-context-telemetry.json`.

**Discover:**
```bash
find . -name "CONTEXT.md" -not -path "*/node_modules/*" -not -path "*/.planning/*"
```
Also load prior phase outputs from `.forgeflow/<project-name>/` (discussion, research, plan files as applicable per command).

**Read:** Read all discovered files into orchestrator context (one pass).

**Bundle:** Assemble `<injected-context>` blocks using this canonical format:
```xml
<injected-context>
<context-meta command="/plan" agent="{agent-name}" files="{n}" complete="{true|false}" />

IMPORTANT: All file contents below are pre-loaded by the orchestrator. Do NOT call Read, Grep, or Glob for any file already present in this block. If you encounter a reference to an unlisted file during your work, note it in your output — do not self-expand scope.

<shared-files>
</shared-files>

<agent-files>
<file path="path/to/agent-specific-file.md">
[file contents verbatim]
</file>
</agent-files>

</injected-context>
```

For single-agent commands (discuss, research, plan): all files go into `<agent-files>`. `<shared-files>` is empty (`<shared-files></shared-files>`).

Inject this block into every agent prompt in subsequent steps. Add at the top of each agent's task description: `Context is pre-loaded in <injected-context> below. Do not re-read those files.`

## Step 1: Load prior phase outputs

```bash
PROJECT_NAME=$(basename "$(pwd)")
FORGEFLOW_DIR=".forgeflow/${PROJECT_NAME}"
DISCUSSION_PATH="${FORGEFLOW_DIR}/current-discussion.md"
RESEARCH_PATH="${FORGEFLOW_DIR}/current-research.md"
```

Also check for a `CONTEXT.md` in the current working directory. If it exists, read it — it contains service-specific architecture context that informs planning scope and agent assignments. Pass the content to both Compass and Atlas.

Read both files if they exist. If the discussion or research is missing, note this gap — the plan will be less informed.

## Step 2: Spawn Compass and Atlas in parallel

**`compass-plan`** receives:
- `Context is pre-loaded in <injected-context> below. Do not re-read those files.`
- The `<injected-context>` block assembled in Step 0
- Discussion summary and research findings
- Instruction to create phased plan with accessibility woven into each phase
- Any additional constraints from $ARGUMENTS
- Working directory path

**`atlas-early`** receives:
- `Context is pre-loaded in <injected-context> below. Do not re-read those files.`
- The `<injected-context>` block assembled in Step 0
- Discussion summary and research findings
- FORGEFLOW_DIR path for persistent context
- Phase instruction: "You are in the **plan** phase — validate scope, flag coordination risks, check for conflicts with prior learnings or patterns, persist plan"
- Working directory path

## Step 3: Synthesize plan

After both agents complete, combine into a unified Implementation Plan.

Compass's plan structure is the backbone. Atlas's scope validation and coordination risks are integrated.

## Step 4: Present and save

Display the Implementation Plan to the user. Save to `.forgeflow/<project-name>/current-plan.md`.

```
## Plan Ready

{Implementation Plan}

### Scope Summary
{In scope / Out of scope / Deferred}

### Accessibility Checklist
{All a11y requirements with phase assignments}

Next: `/consult` to run technical consultation on this plan
Or: modify the plan, then run `/consult`
```

</process>

<success_criteria>
- [ ] Plan built on discussion requirements and research findings
- [ ] Clear phases with deliverables and success criteria
- [ ] Accessibility woven into each phase (not a separate phase)
- [ ] Scope boundaries defined (in/out/deferred)
- [ ] Dependencies and parallelization identified
- [ ] Risk mitigations concrete and actionable
- [ ] Atlas validated scope and flagged coordination risks
- [ ] Plan saved to .forgeflow/ for reference
</success_criteria>
