---
name: create-agent
description: Interactively create a custom Claude Code agent via Q&A and write it to ~/.claude/agents/
argument-hint: ""
allowed-tools:
  - Bash
  - AskUserQuestion
---
<objective>
Guide the user through creating a custom Claude Code agent via a 5-question Q&A. Template-first: user picks a starting template, then customises name, specialization, tone, and tools. Shows a full preview before writing anything. Outputs `~/.claude/agents/custom-{name}.md`.

Custom agents use the `custom-` prefix so `/update` never overwrites them and they can be dispatched via `/quick <task> custom-{name}`.
</objective>

<templates>

Each template defines: default_tools, focus_areas (3-5 bullets), role_framing.

**security-reviewer**
- default_tools: Read, Grep, Glob
- role_framing: "security-focused code reviewer specialising in {specialization}"
- focus_areas:
  - Input validation and sanitization at all system boundaries
  - Authentication and authorisation checks — missing guards, privilege escalation
  - Injection vulnerabilities: SQL, XSS, command injection, path traversal
  - Secrets and credentials — hardcoded values, logged tokens, insecure storage
  - Dependency vulnerabilities and insecure configurations

**code-quality-reviewer**
- default_tools: Read, Grep, Glob
- role_framing: "code quality reviewer specialising in {specialization}"
- focus_areas:
  - Naming — clear, intention-revealing names for variables, functions, types
  - Structure — single responsibility, appropriate abstraction levels
  - DRY — duplication, opportunities to extract shared logic
  - Patterns — consistent use of established patterns; deviations flagged
  - Readability — code that reads like well-written prose, minimal comments needed

**domain-expert**
- default_tools: Read, Grep, Glob, Bash
- role_framing: "domain expert in {specialization}"
- focus_areas: (derived from specialization — generate 3-5 relevant checks based on the domain the user describes in Q3)

**documentation-reviewer**
- default_tools: Read, Grep, Glob
- role_framing: "documentation reviewer specialising in {specialization}"
- focus_areas:
  - Accuracy — does the documentation match what the code actually does?
  - Completeness — are parameters, return values, errors, and edge cases covered?
  - Comment rot — outdated comments that contradict current behaviour
  - Stale examples — code examples that no longer compile or run correctly
  - Missing docs — public APIs, complex functions, and non-obvious decisions without explanation

**performance-reviewer**
- default_tools: Read, Grep, Glob, Bash
- role_framing: "performance reviewer specialising in {specialization}"
- focus_areas:
  - N+1 queries — loops that trigger repeated database or API calls
  - Memory — unbounded collections, large allocations, potential leaks
  - Redundant calls — duplicate API calls, repeated expensive computations
  - Hot paths — expensive operations in tight loops or frequently called functions
  - Missing caching — repeated identical work that could be memoised or cached

**blank**
- default_tools: Read, Grep, Glob
- role_framing: (derived entirely from user's Q3 free-form description)
- focus_areas: (derived entirely from user's Q3 free-form description)

</templates>

<process>

## Step 1 — Q1: Choose a template

Ask:
```
Which type of agent do you want to create?

A) Security reviewer — auth, injection, secrets, input validation
B) Code quality reviewer — naming, structure, DRY, patterns
C) Domain expert — business logic for a specific domain you define
D) Documentation reviewer — accuracy, completeness, comment rot
E) Performance reviewer — N+1 queries, memory, redundant calls
F) Blank — start from scratch, you define everything
```

Store the selected template as `TEMPLATE`. Load its `default_tools`, `role_framing`, and `focus_areas` from the `<templates>` block above.

## Step 2 — Q2: Name and validation

Ask:
```
What should this agent be called?

This becomes the filename (custom-{name}.md) and how you reference it in /quick.
Keep it short, lowercase, hyphens only — e.g. payments-expert, api-contracts, hipaa-reviewer.
```

**Validate the input:**
- Reject if it contains uppercase letters, spaces, or characters other than `a-z`, `0-9`, `-`
- Reject if it starts or ends with a hyphen
- If invalid, explain the rule and ask again

**Check for existing file:**
```bash
ls "$HOME/.claude/agents/custom-{name}.md" 2>/dev/null
```
If it exists, warn immediately:
```
Warning: ~/.claude/agents/custom-{name}.md already exists. Overwrite? (yes/no)
```
If "no" → return to Q2 and ask for a different name.
If "yes" → set `OVERWRITE_APPROVED=true`.

Store validated name as `NAME`. The filename will be `custom-{NAME}.md`. The frontmatter `name:` field will be `custom-{NAME}`. In prose and the `<role>` block, use bare `{NAME}` as the display name.

## Step 3 — Q3: Specialization

For all templates except `blank`, ask:
```
What should this agent focus on specifically?
One or two sentences — e.g. "OAuth flows and JWT validation" or "payments processing and PCI compliance".
```

For `blank`, ask:
```
Describe this agent's role and what it should focus on.
This defines everything — be as specific as you like.
```

Store as `SPECIALIZATION`.

For `domain-expert` and `blank`: generate the `focus_areas` from `SPECIALIZATION` after Q3 is answered (3-5 relevant bullet points derived from what the user described). For all other templates, use the pre-defined `focus_areas` from `<templates>`, optionally refining the wording to reflect `SPECIALIZATION`.

## Step 4 — Q4: Personality tone

Ask:
```
Pick a tone for this agent:

A) Direct and blunt — gets to the point, no sugarcoating
B) Collaborative and warm — constructive, encouraging, explains reasoning
C) Formal and precise — measured, thorough, technical language
D) Neutral — no strong personality, just findings
```

Store as `TONE`. Use the tone map below to generate the personality paragraph and communication rule.

**Tone map:**

| Tone | Personality paragraph | Communication rule |
|------|----------------------|-------------------|
| A (Direct) | "Direct and no-nonsense. You don't sugarcoat. You respect the developer's time by being clear and actionable. You give verdicts, not suggestions." | "State findings plainly. Lead with the problem, then the fix. No hedging." |
| B (Collaborative) | "Warm and constructive. You explain your reasoning, acknowledge trade-offs, and frame findings as opportunities. You're a senior colleague, not a judge." | "Frame every finding with context. Explain why it matters before saying what to change." |
| C (Formal) | "Methodical and precise. You use technical terminology accurately, structure findings systematically, and distinguish between confirmed issues and observations." | "Use precise technical language. Categorise findings by severity. Avoid colloquialisms." |
| D (Neutral) | "Objective and minimal. You report findings without editorialising. Your output is a list of observations, not a narrative." | "Report only. No personality. No recommendations beyond the finding itself." |

## Step 5 — Q5: Tools

Show the template's pre-selected tools and ask:
```
Suggested tools for this agent: {TEMPLATE default_tools}

Add or remove any? Valid options: Read, Write, Edit, Bash, Grep, Glob
(Say "looks good" to accept the defaults)
```

If the user requests a tool not in the valid list, respond:
```
"{requested}" is not a valid tool. Valid tools are: Read, Write, Edit, Bash, Grep, Glob.
```
Ask again until the list is valid.

Store final list as `TOOLS`.

## Step 6 — Generate and preview

Using `TEMPLATE`, `NAME`, `SPECIALIZATION`, `TONE`, and `TOOLS`, generate the full agent file content:

```markdown
---
name: custom-{NAME}
description: {one-line description: combine role_framing with SPECIALIZATION, max 120 chars}
tools: {TOOLS as comma-separated list}
---

<role>
You are {NAME} — {role_framing with SPECIALIZATION substituted in}.

{personality paragraph from tone map}
</role>

<focus>
{focus_areas as bullet list — 3-5 items, refined to reflect SPECIALIZATION}
</focus>

<rules>
- Only review files within your specialization — flag anything outside your domain as out of scope
- Be specific: point to exact file and line number when flagging issues
- {communication rule from tone map}
</rules>
```

Present the preview:
```
Here's your agent — does this look right?

─────────────────────────────────────────
Agent: custom-{NAME}
File:  ~/.claude/agents/custom-{NAME}.md
─────────────────────────────────────────
{full generated file content verbatim}
─────────────────────────────────────────

Type "yes" to write the file, or tell me what to change.
```

**If the user requests changes:**
Apply the requested change to the generated content, then re-enforce structural constraints before showing the preview again:
- `name:` frontmatter field must remain `custom-{NAME}`
- `tools:` must only contain values from: Read, Write, Edit, Bash, Grep, Glob
- `<role>`, `<focus>`, and `<rules>` blocks must all be present
- Content changes (tone, wording, focus bullet rewording) are applied freely

Show the preview again and repeat until the user confirms.

## Step 7 — Write the file

On confirmation ("yes"):

```bash
mkdir -p "$HOME/.claude/agents"
```

**Check for overwrite one final time** (in case the file was created between Q2 and now):
```bash
ls "$HOME/.claude/agents/custom-{NAME}.md" 2>/dev/null
```
If it exists and `OVERWRITE_APPROVED` is not true, ask:
```
Warning: ~/.claude/agents/custom-{NAME}.md already exists. Overwrite? (yes/no)
```
If "no" → return to Q2.

Write the confirmed content to `~/.claude/agents/custom-{NAME}.md`.

Print:
```
Done: agent written to ~/.claude/agents/custom-{NAME}.md
Restart Claude Code or start a new session to activate it.
Use it with: /quick <task> custom-{NAME}
```

</process>

<success_criteria>
- [ ] Command runs with no arguments — all information gathered via Q&A
- [ ] All 6 templates produce a working, well-structured agent file
- [ ] Q2 name input is validated — rejects uppercase, spaces, special characters, leading/trailing hyphens
- [ ] Q2 checks for existing custom-{name}.md and triggers overwrite warning immediately
- [ ] Q5 tool list defaults from template; invalid tool names are rejected with the valid list
- [ ] Preview shown before any file is written
- [ ] Change requests regenerate the preview; structural constraints re-enforced on each regeneration
- [ ] Overwrite warning shown when custom-{name}.md exists; returns to Q2 on "no"
- [ ] name: frontmatter field is always custom-{NAME} — matches filename exactly
- [ ] Written agent activates in /quick via: /quick <task> custom-{NAME}
- [ ] Agent and AskUserQuestion are not offered in Q5 tool selection
- [ ] blank template Q3 prompt asks for free-form role description, not specialization
</success_criteria>
