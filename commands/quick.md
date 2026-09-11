---
name: quick
description: Run one or more Forgeflow agents directly on a short task — no full lifecycle required
argument-hint: "<task description> [fc,guardian,...] [fc:implement,...] [+architect]"
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
  source "$FORGEFLOW_INIT_SESSION" "quick" "$*"
else
  CHAT_AVAILABLE=false
  CHAT_SEND=""
  ROOM_NAME="quick"
  export CHAT_AVAILABLE CHAT_SEND ROOM_NAME
fi
```
<objective>
Run one or more Forgeflow agents directly on a short task description, bypassing the full `/discuss` → `/research` → `/plan` → `/consult` → `/implement` → `/review` → `/ship` lifecycle. Token-efficient: only the agents genuinely needed are spawned.

Three execution paths depending on how agents are specified:
1. **No agents** — domain heuristics route to the single best-fit agent automatically
2. **Agents without modes** — agents self-select their mode via a lightweight pre-flight; user confirms before work begins
3. **Agents with explicit modes** — fires immediately, no confirmation
</objective>

<context>
$ARGUMENTS format: `<task description> [agent-list] [+architect]`

Agent aliases: `fc` (builder), `guardian`, `designer` (designer), `cory` (coordinator), `architect`, `product_lead`
Valid modes: `implement`, `review`, `consult`, `audit` (product_lead uses a different set — see parsing section)
</context>

<parsing>

## Custom Agent Pre-Check (runs before all other parsing)

Before any alias validation or mode checking, scan the last whitespace-separated segment of `$ARGUMENTS` for custom agent tokens:

1. Strip a trailing `+architect` from `$ARGUMENTS` first (independent of the main parsing strip — both must happen). If stripped, set `HAS_NANDO=true`. Take the last whitespace-separated segment of the result and split on commas.
2. For each token, strip any `:mode` suffix to get the bare name. Do not validate the mode value — it is discarded regardless of content.
3. Validate the bare name: it must start with `custom-` **and** match `^custom-[a-zA-Z0-9_-]+$`. If it starts with `custom-` but fails the full pattern (e.g. `custom-../../etc/passwd`), stop: `"Invalid agent name: {token}. Custom agent names must be lowercase letters, digits, and hyphens only."`
4. Check if `~/.claude/agents/$bare_name.md` exists:
   ```bash
   [ -f "$HOME/.claude/agents/$bare_name.md" ]
   ```
5. If **any** token is a confirmed custom agent:
   - If the token had a `:mode` suffix, emit: `"Note: {bare-name} is a single-mode agent — :{mode} suffix ignored."`
   - **5a:** Treat ALL confirmed custom tokens as **Path 3 explicit dispatch** with `subagent_type: {bare-name}` (no mode suffix appended).
   - **5b:** Non-custom tokens in the same list must have explicit `:mode` suffixes (standard Path 3 rule). If any don't, stop: `"Mixed agent list: when using custom agents, all Forgeflow agents must have explicit modes (e.g. guardian:review)."`
   - Skip all remaining parsing steps. Go directly to Path 3 execution.
6. If **no** custom agents found, continue to normal `## Argument Parsing` below.

## Argument Parsing

Parse `$ARGUMENTS` right-to-left:

1. Strip trailing `+architect` if present. Set `HAS_NANDO=true`.
2. Check whether the last whitespace-separated segment is a valid agent list — one or more comma-separated tokens each matching `[alias]` or `[alias]:[mode]` with no spaces inside the segment.
3. If it is a valid agent list: that segment is `AGENT_LIST`; everything to its left is `TASK`.
4. If it is not a valid agent list: entire `$ARGUMENTS` (minus `+architect`) is `TASK`; `AGENT_LIST` is empty → Path 1.

**Validation — hard stop with message if any rule is violated:**

- `TASK` is empty → `"Task description is required."`
- Unknown alias in `AGENT_LIST` (e.g. `carlos`) → `"Unknown agent: carlos. Valid aliases: fc, guardian, designer, cory, architect, product_lead."`
- `product_lead` without explicit mode in `AGENT_LIST` → `"product_lead requires an explicit mode in /quick. Valid modes: implement, review, discuss, research, plan, present."`
- Invalid mode for `product_lead` (e.g. `product_lead:consult`) → `"Invalid mode 'consult' for product_lead. Valid modes: implement, review, discuss, research, plan, present."`
- Invalid mode for other agents (e.g. `fc:ship`) → `"Invalid mode 'ship' for fc. Valid modes: implement, review, consult, audit."`
- More than 4 agents in `AGENT_LIST` (Path 2 only) → `"Too many agents for /quick (max 4). Use /implement for full-Forgeflow work."`

**Resolve aliases to full names:**
- `fc` → `builder`
- `designer` → `designer`
- `cory` → `coordinator`
- All others (`guardian`, `architect`, `product_lead`) → unchanged

**Determine execution path:**
- `AGENT_LIST` empty → **Path 1**
- `AGENT_LIST` has agents, none have `:mode` suffix → **Path 2**
- All agents in `AGENT_LIST` have `:mode` suffix → **Path 3**
- Mixed (some with mode, some without) → `"Mixed agent list not supported: either all agents must have explicit modes or none. Use fc:implement,guardian or fc,guardian — not both."`

</parsing>

<process>

## Path 1 — Direct Routing (no agents specified)

Apply domain heuristics to determine the single best-fit agent and mode:

- security / auth / validation / hardening → `guardian`
- database / schema / business logic / models → `builder`
- frontend / UX / accessibility / service connectivity → `designer`
- When unclear, pick the dominant concern.

Pick ONE agent. Only escalate to TWO if the task genuinely spans two clearly separable domains (e.g. security hardening on a frontend component). Maximum two agents.

Determine mode from task description: `implement` (build/add/fix), `review` (inspect/check/audit), `consult` (design/plan), `audit` (deep audit).

**Context Pre-Loading:** After routing (routing determines which agent, then load only what's relevant). Apply the security denylist: exclude `.env`, `*.pem`, `*.key`, `*.p12`, `*.cert`, `*.secret`, and any file with `password`, `secret`, or `token` in the filename (case-insensitive). Discover and read: (1) any CONTEXT.md files found via `find . -name "CONTEXT.md" -not -path "*/node_modules/*"`; (2) all files from `git diff --name-only HEAD` if non-empty. Bundle all read files into `<agent-files>` in an `<injected-context>` block.

Spawn the chosen agent(s) using the Agent tool (subagent_type: `{agent-name}-{mode}`). Each agent's prompt:

```
Context is pre-loaded in <injected-context> below. Do not re-read those files.

Task: {TASK}

Working directory: {cwd}

<injected-context>
<context-meta command="/quick" agent="{agent-name}-{mode}" files="{n}" complete="{true|false}" />

IMPORTANT: All file contents below are pre-loaded by the orchestrator. Do NOT call Read, Grep, or Glob for any file already present in this block. If you encounter a reference to an unlisted file during your work, note it in your output — do not self-expand scope.

<shared-files></shared-files>

<agent-files>
<file path="{path}">
{file contents verbatim}
</file>
</agent-files>

</injected-context>
```

After agents complete, display outputs using the format:
```
=== {AGENT NAME} ({mode}) ===
{output}
```

If `HAS_NANDO=true`, after the primary agents complete, proceed to the **+architect synthesis** section.

## Path 2 — Self-Select Pre-Flight (agents without explicit modes)

### Step 1: Pre-flight

Spawn each agent in `AGENT_LIST` in parallel using the Agent tool. Use subagent_type: `{agent-name}-consult` for the pre-flight (lightest available mode). Pre-flight prompts are **exempt from context injection** — the 3-line response format makes injection wasteful. Prompt each agent:

```
Task: {TASK}

Working directory: {cwd}

Reply in this exact format — no other text:
MODE: [implement|review|consult|audit]
RELEVANCE: [high|medium|low]
REASON: [one line — what you would specifically do for this task]
```

Collect all responses.

### Step 2: Filter

Keep only agents that returned `RELEVANCE: high`. Drop medium and low silently.

**All-low edge case** — if no agents returned high:

Display (pipe-separated, all agents in user-specified order):
```
No agents rated this task as high relevance.
Results: {AGENT1}: {relevance} | {AGENT2}: {relevance} | ...
Options: (p)roceed with highest-rated agent, (e)dit agent list, (a)bort
```

Use `AskUserQuestion` to capture the user's choice.

- `p` → pick the agent with the highest relevance (prefer medium over low; ties broken by user-specified order). Spawn directly — skip the step-3 confirmation.
- `e` → go to the edit flow (Step 4 below).
- `a` → stop silently.

### Step 3: Confirm kept agents

Use `AskUserQuestion` to show only the kept (high-relevance) agents and ask for confirmation:

```
{AGENT1}: {self-selected mode} — {reason}
{AGENT2}: {self-selected mode} — {reason}
Proceed? (y/n/edit)
```

- `y` → Apply the security denylist (exclude `.env`, `*.pem`, `*.key`, `*.p12`, `*.cert`, `*.secret`, and filenames containing `password`, `secret`, or `token`). Discover and read: CONTEXT.md files + `git diff --name-only HEAD` (if non-empty). Files needed by 2+ agents go to `<shared-files>`; agent-specific files go to `<agent-files>`. Then spawn each kept agent with their self-selected mode (subagent_type: `{agent-name}-{mode}`). Each agent's prompt:

```
Context is pre-loaded in <injected-context> below. Do not re-read those files.

Task: {TASK}

Working directory: {cwd}

<injected-context>
<context-meta command="/quick" agent="{agent-name}-{mode}" files="{n}" complete="{true|false}" />

IMPORTANT: All file contents below are pre-loaded by the orchestrator. Do NOT call Read, Grep, or Glob for any file already present in this block. If you encounter a reference to an unlisted file during your work, note it in your output — do not self-expand scope.

<shared-files>
<file path="{path}">
{file contents verbatim}
</file>
</shared-files>

<agent-files>
<file path="{path}">
{file contents verbatim}
</file>
</agent-files>

</injected-context>
```
- `n` → stop silently.
- `edit` → go to the edit flow.

### Step 4: Edit flow

Use `AskUserQuestion` to prompt:
```
Enter revised agent list (e.g. fc:implement,guardian:review):
```

Parse and validate the user's input as an explicit `agent:mode` list. If valid, fire immediately (Path 3 logic). If invalid, show the validation error and re-prompt once. If still invalid, display `"Aborting."` and stop.

**Special case — `architect` in agent list + `HAS_NANDO=true`:**
If `architect` appears in `AGENT_LIST` (Path 2, no explicit mode) and `HAS_NANDO=true`, treat as equivalent — skip the Architect pre-flight entirely and run Architect once as synthesiser (`architect-review`) after the other agents complete. Do not spawn Architect in the pre-flight step.

If `architect` appears in `AGENT_LIST` without `HAS_NANDO`, it goes through the normal pre-flight and runs as a peer agent in its self-selected mode (subagent_type: `architect-{self-selected-mode}`).

If `HAS_NANDO=true` (and architect not in AGENT_LIST), after primary agents complete, proceed to **+architect synthesis**.

---

## Path 3 — Explicit Modes (agents with :mode specified)

Validate all agent names and modes. If `architect` has an explicit mode and `+architect` is also present, the explicit mode takes precedence — Architect runs as a peer agent in its specified mode, and the `+architect` synthesis pass is skipped.

**Context Pre-Loading:** Apply the security denylist (exclude `.env`, `*.pem`, `*.key`, `*.p12`, `*.cert`, `*.secret`, and filenames containing `password`, `secret`, or `token`). Discover and read: CONTEXT.md files + `git diff --name-only HEAD` (if non-empty). Files needed by 2+ agents go to `<shared-files>`; agent-specific files go to `<agent-files>`.

Spawn all agents in parallel using the Agent tool (subagent_type: `{agent-name}-{mode}`). Each agent's prompt:

```
Context is pre-loaded in <injected-context> below. Do not re-read those files.

Task: {TASK}

Working directory: {cwd}

<injected-context>
<context-meta command="/quick" agent="{agent-name}-{mode}" files="{n}" complete="{true|false}" />

IMPORTANT: All file contents below are pre-loaded by the orchestrator. Do NOT call Read, Grep, or Glob for any file already present in this block. If you encounter a reference to an unlisted file during your work, note it in your output — do not self-expand scope.

<shared-files>
<file path="{path}">
{file contents verbatim}
</file>
</shared-files>

<agent-files>
<file path="{path}">
{file contents verbatim}
</file>
</agent-files>

</injected-context>
```

No confirmation step.

If `HAS_NANDO=true` (and Architect was not explicitly listed with a mode), proceed to **+architect synthesis** after agents complete.

---

## +architect Synthesis

Spawn `architect-review` with all primary agent outputs concatenated:

```
Task:
---
{TASK}
---

Working directory: {cwd}

Here are the outputs from your Forgeflow:

{for each agent:}
=== {AGENT NAME} ({mode}) ===
{agent output}

Synthesize these outputs into a consolidated verdict. Focus on the task above — flag conflicts, highlight key findings, provide clear next steps.
```

---

## Output Format

Display agent outputs in user-specified order (or routing-determined order for Path 1 — primary first, secondary second). Each section preceded by a header:

```
=== {AGENT NAME} ({mode}) ===
{agent output}
```

If +architect:
```
=== NANDO (synthesis) ===
{architect verdict}
```

</process>

<success_criteria>
- [ ] Path 1: domain heuristics route to single best-fit agent without confirmation
- [ ] Path 2: Pre-flight fires in parallel; only high-relevance agents proceed; user confirms before work
- [ ] Path 2 all-low: user prompted with p/e/a options; p picks first highest-rated agent
- [ ] Path 3: agents fire immediately with no pre-flight or confirmation
- [ ] +architect: Architect synthesis runs after primary agents complete
- [ ] Validation errors halt execution with clear messages
- [ ] Output displayed in user-specified order with === AGENT (mode) === headers
- [ ] No .forgeflow/ artifacts written; no learnings.jsonl updates
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
