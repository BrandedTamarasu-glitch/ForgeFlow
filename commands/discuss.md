---
name: discuss
description: Run the Forgeflow in discussion mode — explore the problem space before any technical work
argument-hint: "<description of what to build or problem to solve>"
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
FORGEFLOW_REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel 2>/dev/null || true)"
FORGEFLOW_INIT_SESSION="${FORGEFLOW_REPO_ROOT}/services/chat-bridge/init-session.sh"
if [ -f "$FORGEFLOW_INIT_SESSION" ]; then
  source "$FORGEFLOW_INIT_SESSION" "discuss" "$*"
else
  CHAT_AVAILABLE=false
  CHAT_SEND=""
  ROOM_NAME="discuss"
  export CHAT_AVAILABLE CHAT_SEND ROOM_NAME
fi
```
<objective>
Run Compass and Atlas in discussion mode to explore the problem space, gather requirements, define success criteria, and identify open questions for research.

The discussion team:
1. **Compass** (`compass-discuss`) — Problem framing, requirements, success criteria, accessibility, UX vision
2. **Atlas** (`atlas-early`) — Prior learnings, fresh perspective challenges, memory retention
</objective>

<context>
$ARGUMENTS — Description of what to build or the problem to solve. Can be:
- Freeform text: "Add user authentication with OAuth"
- File reference: "implement the changes described in docs/spec.md"
- Task reference: "the feature from issue #42"

$ARGUMENTS is provided by the user after the slash command (e.g., `/discuss Add user auth`). The command runner injects it as the argument string.
</context>

<process>

## Step 0: Context Pre-Loading

Apply the security denylist before reading any file: exclude `.env`, `*.pem`, `*.key`, `*.p12`, `*.cert`, `*.secret`, and any file with `password`, `secret`, or `token` in the filename (case-insensitive).

**Discover:**
```bash
find . -name "CONTEXT.md" -not -path "*/node_modules/*" -not -path "*/.planning/*"
```
Also load prior phase outputs from `.forgeflow/<project-name>/` (discussion, research, plan files as applicable per command).

**Read:** Read all discovered files into orchestrator context (one pass).

**Bundle:** Assemble `<injected-context>` blocks using this canonical format:
```xml
<injected-context>
<context-meta command="/discuss" agent="{agent-name}" files="{n}" complete="{true|false}" />

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

## Step 1: Gather initial context

**Check for CONTEXT.md files first:**
```bash
find . -name "CONTEXT.md" -not -path "*/node_modules/*" -not -path "*/.planning/*"
```
If found, read them — these are pre-written service summaries. Pass them to both agents instead of having agents explore broadly.

If no CONTEXT.md exists, read relevant files to understand the current state:
- Project structure (key directories, entry points)
- README or documentation for project goals
- Existing feature patterns

## Step 2: Load Atlas's persistent context

```bash
PROJECT_NAME=$(basename "$(pwd)")
FORGEFLOW_DIR=".forgeflow/${PROJECT_NAME}"
mkdir -p "${FORGEFLOW_DIR}/agent-notes"
```

## Step 3: Spawn Compass and Atlas in parallel

Spawn both agents using the Agent tool:

**`compass-discuss`** receives:
- `Context is pre-loaded in <injected-context> below. Do not re-read those files.`
- The `<injected-context>` block assembled in Step 0
- The task description ($ARGUMENTS)
- Instruction to define requirements, success criteria, and accessibility needs
- Working directory path

**`atlas-early`** receives:
- `Context is pre-loaded in <injected-context> below. Do not re-read those files.`
- The `<injected-context>` block assembled in Step 0
- The task description ($ARGUMENTS)
- FORGEFLOW_DIR path for loading persistent context
- Phase instruction: "You are in the **discuss** phase — surface prior learnings, challenge assumptions, bounce ideas with Compass"
- Working directory path

## Step 4: Synthesize discussion

After both agents complete, combine their outputs into a unified Discussion Summary.

Compass's output is the primary structure. Atlas's contributions are woven in where they add value.

## Step 5: Present and save

Display the Discussion Summary to the user. Save to `.forgeflow/<project-name>/current-discussion.md`.

```
## Discussion Complete

{Discussion Summary}

### Open Questions for Research
{questions that need investigation}

Next: `/research` to investigate open questions
Or: modify the discussion summary, then run `/research`
```

</process>

<success_criteria>
- [ ] Problem clearly framed
- [ ] Requirements gathered (must have / should have / nice to have)
- [ ] Success criteria defined with measurable outcomes
- [ ] Accessibility requirements identified
- [ ] UX vision articulated
- [ ] Open questions listed for research phase
- [ ] Atlas surfaced relevant prior learnings
- [ ] Discussion saved to .forgeflow/ for reference
</success_criteria>
