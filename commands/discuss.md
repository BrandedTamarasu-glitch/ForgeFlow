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
Run Product Lead and Coordinator in discussion mode to explore the problem space, gather requirements, define success criteria, and identify open questions for research.

The discussion team:
1. **Product Lead** (`product-lead-discuss`) — Problem framing, requirements, success criteria, accessibility, UX vision
2. **Coordinator** (`coordinator-early`) — Prior learnings, fresh perspective challenges, memory retention
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

## Step 2: Load Coordinator's persistent context

```bash
PROJECT_NAME=$(basename "$(pwd)")
FORGEFLOW_DIR=".forgeflow/${PROJECT_NAME}"
mkdir -p "${FORGEFLOW_DIR}/agent-notes"
```

## Step 3: Spawn Product Lead and Coordinator in parallel

Spawn both agents using the Agent tool:

**`product-lead-discuss`** receives:
- `Context is pre-loaded in <injected-context> below. Do not re-read those files.`
- The `<injected-context>` block assembled in Step 0
- The task description ($ARGUMENTS)
- Instruction to define requirements, success criteria, and accessibility needs
- Working directory path

**`coordinator-early`** receives:
- `Context is pre-loaded in <injected-context> below. Do not re-read those files.`
- The `<injected-context>` block assembled in Step 0
- The task description ($ARGUMENTS)
- FORGEFLOW_DIR path for loading persistent context
- Phase instruction: "You are in the **discuss** phase — surface prior learnings, challenge assumptions, bounce ideas with Product Lead"
- Working directory path

## Step 4: Synthesize discussion

After both agents complete, combine their outputs into a unified Discussion Summary.

Product Lead's output is the primary structure. Coordinator's contributions are woven in where they add value.

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
- [ ] Coordinator surfaced relevant prior learnings
- [ ] Discussion saved to .forgeflow/ for reference
</success_criteria>

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
