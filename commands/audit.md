---
name: audit
description: Run a deep security, architecture, and systems audit across the codebase or a specific subsystem
argument-hint: "[optional: path or subsystem to focus on, e.g., 'src/auth' or 'database schema']"
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
  source "$FORGEFLOW_INIT_SESSION" "audit" "$*"
else
  CHAT_AVAILABLE=false
  CHAT_SEND=""
  ROOM_NAME="audit"
  export CHAT_AVAILABLE CHAT_SEND ROOM_NAME
fi
```
<objective>
Run Builder and Guardian in deep audit mode to surface security vulnerabilities, architectural debt, schema health issues, dead code, and reuse opportunities. Architect synthesizes findings into a prioritized action list.

The audit team: `guardian-audit` (security + architecture) + `builder-audit` (systems + database) → `architect-review` (synthesis).
</objective>

<context>
$ARGUMENTS — Optional. Can be:
- Empty: audits the whole codebase
- Path: audits a specific directory or subsystem (e.g., `src/auth`, `src/db`)
- Subsystem label: audits by domain (e.g., `database schema`, `API boundaries`)
</context>

<process>

## Step 1: Load context

```bash
PROJECT_NAME=$(basename "$(pwd)")
FORGEFLOW_DIR=".forgeflow/${PROJECT_NAME}"
```

Check for `CONTEXT.md` in the working directory — if it exists, read it. It provides service-specific architecture context that helps both agents understand system boundaries.

If $ARGUMENTS specifies a path, resolve it and confirm it exists before passing to agents.

## Step 2: Spawn Builder and Guardian in parallel

Both agents audit independently. Spawn them simultaneously.

Each agent prompt must include:
- Working directory path
- Focus area (from $ARGUMENTS, or "entire codebase" if empty)
- CONTEXT.md contents if available
- Instruction to read files before forming opinions — no assumptions

**`builder-audit`** — focus on:
- Database schema, query patterns, index coverage, migration health
- Dead code, duplication, established vs deprecated patterns
- Dependency hygiene

**`guardian-audit`** — focus on:
- Auth flows, input validation, injection surfaces, secret handling
- System boundary coupling, data flow correctness, integration health
- Reinvented wheels and reuse opportunities

## Step 3: Synthesize with Architect

After both agents complete, spawn `architect-review` with all findings concatenated.

Architect's prompt:
```
You are synthesizing an audit (not a code review of a PR). The following are deep audit
findings from Builder (systems/database) and Guardian (security/architecture).

=== Builder — Systems Audit ===
{builder_output}

=== JARED — Security & Architecture Audit ===
{guardian_output}

Focus area: {arguments_or_whole_codebase}
Working directory: {cwd}

Produce a consolidated audit report:

## Critical (fix immediately — security or data integrity risk)
## High (fix before next feature — architectural debt blocking progress)
## Medium (schedule soon — quality or efficiency improvements)
## Low (backlog — nice-to-have cleanups)
## Highlights (things that are working well and should be preserved)

For each finding: source agent, file:line if applicable, concrete recommended action.
Resolve any conflicts between Builder and Guardian. If they agree, say so — it strengthens the finding.
```

## Step 3.5: Persist findings

After Architect completes, spawn `coordinator-review` to persist findings to the Forgeflow team's memory.

Coordinator's prompt:
```
You are persisting audit findings for the Forgeflow's collective memory.

Working directory: {cwd}
Forgeflow directory: {FORGEFLOW_DIR}
Audit scope: {arguments_or_whole_codebase}

=== NANDO — Consolidated Audit ===
{architect_output}

1. Append one JSON line to {FORGEFLOW_DIR}/learnings.jsonl (create file if absent):
   {"date": "<today ISO>", "type": "audit", "scope": "<scope>", "critical_count": <n>, "high_count": <n>, "summary": "<1-2 sentence summary of most important findings>"}

2. Append Architect's full report to {FORGEFLOW_DIR}/review-history.md (create file if absent):
   ## Audit — <today ISO> — <scope>
   {architect_output}

Do not summarise or editorialize beyond the learnings.jsonl summary line.
```

## Step 4: Present results

Display the consolidated audit report.

```
## Audit Complete

{Architect's consolidated findings}

### Audit Scope
{What was audited — full codebase or specific subsystem}

### Next Steps
Address Critical findings before any new development.
High findings should be scheduled as dedicated cleanup work.
```

Save the audit report to `${FORGEFLOW_DIR}/audit-<date>.md` for reference.

</process>

<success_criteria>
- [ ] Builder and Guardian audited in parallel
- [ ] Both agents read files before forming opinions
- [ ] Architect synthesized findings with priority tiers
- [ ] Conflicts between agents resolved
- [ ] Audit report saved to .forgeflow/
- [ ] Audit findings persisted to .forgeflow/learnings.jsonl and review-history.md
- [ ] Clear next steps presented
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
