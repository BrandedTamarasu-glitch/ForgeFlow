---
name: research
description: Run the Forgeflow in research mode — investigate patterns, technology options, and prior art
argument-hint: "[optional: specific questions to research or path to discussion summary]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
  - WebSearch
  - WebFetch
---
<objective>
Run Compass and Atlas in research mode to investigate open questions from the discussion phase, evaluate technology options, analyze codebase patterns, and identify risks.

The research team:
1. **Compass** (`compass-research`) — Technology evaluation, prior art, accessibility patterns, risk identification, recommendations
2. **Atlas** (`atlas-early`) — Codebase exploration, existing pattern surfacing, prior session memory
</objective>

<context>
$ARGUMENTS — Optional. Can be:
- Empty: loads discussion from `.forgeflow/<project-name>/current-discussion.md`
- Specific questions to research
- Path to a discussion summary file

$ARGUMENTS is provided by the user after the slash command (e.g., `/research` or `/research What auth libraries work with our stack?`). The command runner injects it as the argument string.
</context>

<process>

## Step 0: Context Pre-Loading

Apply the security denylist before reading any file: exclude `.env`, `*.pem`, `*.key`, `*.p12`, `*.cert`, `*.secret`, and any file with `password`, `secret`, or `token` in the filename (case-insensitive).

Build compact local memory context before reading phase files directly:
```bash
PROJECT_NAME=$(basename "$(pwd)")
FORGEFLOW_DIR=".forgeflow/${PROJECT_NAME}"
MEMORY_CONTEXT_PATH="${FORGEFLOW_DIR}/context/research-memory.md"
HELPER_DIR="scripts/forgeflow"
SAFE_ARGS=("${ARGUMENTS:-}")
FORGEFLOW_NODE=(env -u NODE_OPTIONS -u NODE_PATH node)
if [ ! -x "${HELPER_DIR}/build-memory-context.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/build-memory-context.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ -x "${HELPER_DIR}/build-memory-context.js" ]; then
  "${FORGEFLOW_NODE[@]}" "${HELPER_DIR}/build-memory-context.js" --query "${SAFE_ARGS[0]:-research}" --out "$MEMORY_CONTEXT_PATH" --json
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
<context-meta command="/research" agent="{agent-name}" files="{n}" complete="{true|false}" />

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

## Step 1: Load discussion context

Check for existing discussion:
```bash
PROJECT_NAME=$(basename "$(pwd)")
FORGEFLOW_DIR=".forgeflow/${PROJECT_NAME}"
DISCUSSION_PATH="${FORGEFLOW_DIR}/current-discussion.md"
```

**If discussion exists:** Read and use its open questions as the research agenda.
**If $ARGUMENTS provided:** Use as the research focus.
**If neither:** Tell the user to run `/discuss` first or provide research questions.

## Step 2: Spawn Compass and Atlas in parallel

Check for CONTEXT.md files before spawning:
```bash
find . -name "CONTEXT.md" -not -path "*/node_modules/*" -not -path "*/.planning/*"
```
If found, include their content in both agent prompts — agents should read these instead of exploring broadly.

**`compass-research`** receives:
- `Context is pre-loaded in <injected-context> below. Do not re-read those files.`
- The `<injected-context>` block assembled in Step 0
- The discussion summary (or research questions)
- Instruction to evaluate technology options, research accessibility patterns, identify risks
- Working directory path

**`atlas-early`** receives:
- `Context is pre-loaded in <injected-context> below. Do not re-read those files.`
- The `<injected-context>` block assembled in Step 0
- The discussion summary (or research questions)
- FORGEFLOW_DIR path for persistent context
- Phase instruction: "You are in the **research** phase — explore codebase for existing patterns, surface prior approach memories, grep/read relevant source files"
- Working directory path

## Step 3: Synthesize research

After both agents complete, combine outputs into unified Research Findings.

Compass's analysis and recommendations are the primary structure. Atlas's codebase findings and memories are integrated throughout.

## Step 4: Present and save

Display Research Findings to the user. Save to `.forgeflow/<project-name>/current-research.md`.

```
## Research Complete

{Research Findings}

### Recommendation
{Compass's recommended approach}

Next: `/plan` to create the implementation plan
Or: modify the research, then run `/plan`
```

</process>

<success_criteria>
- [ ] Open questions from discussion answered
- [ ] Codebase patterns analyzed by Atlas
- [ ] Technology options evaluated with pros/cons
- [ ] Accessibility patterns researched
- [ ] Risks identified with likelihood and impact
- [ ] Clear recommendation made with rationale
- [ ] Research saved to .forgeflow/ for reference
</success_criteria>
