---
name: research
description: Run the Forgeflow in research mode — investigate patterns, technology options, and prior art
argument-hint: "[--diverge|--no-diverge] [optional: specific questions to research or path to discussion summary]"
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
- `--diverge` followed by a question or summary path: force isolated option generation before evidence-based convergence
- `--no-diverge` followed by a question or summary path: force normal research

$ARGUMENTS is provided by the user after the slash command (e.g., `/research` or `/research What auth libraries work with our stack?`). The command runner injects it as the argument string.
</context>

<process>

## Routing gate

Parse `--diverge` and `--no-diverge` before running any helper or loading project state. Reject both flags together. Remove the selected flag from the research question and record the route reason.

- `--diverge` is an explicit divergent-route override.
- `--no-diverge` is an explicit normal-research override.
- With neither flag and a focused research question, run `scripts/forgeflow/render-research-divergence-advice.js --task "<question>" --json` from the checkout helper root, or its installed-runtime equivalent. Use its `suggested_invocation` as the route. Report the recommendation, reason, and exploratory latency tradeoff before research begins.
- With neither flag and no focused question, use normal research and say that automatic routing needs a focused task.

Automatic routing is advisory-policy execution, not a claim of general superiority. Users can always override it with either flag.

For the divergent route, run the preflight now. Divergence is appropriate for open-ended, consequential decisions with multiple plausible approaches. If selected automatically, abstain and use normal research for lookups, canonical-answer questions, known-root-cause bugs, or low-stakes decisions. An explicit `--diverge` flag overrides this abstention gate. The divergent route is read-only: skip state initialization, memory-context generation, telemetry, and every file write described below.

## Step 0: Context Pre-Loading

Run this step only for the default route. For `--diverge`, read narrowly relevant existing discussion, memory, `CONTEXT.md`, accessibility, and codebase material only for the independent Atlas evidence lane and later Compass critic. Do not generate or update context artifacts.

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

## Divergent route: isolated generation and separate criticism

When `--diverge` is active, replace Steps 2 and 3 with this route:

1. Extract a minimal branch packet containing only:
   - the research task
   - immutable constraints explicitly stated by the user
   - exactly one frame
   - this candidate format: `Approach`, `Why it could work`, `Key assumptions`, `Failure signals`, `First experiment`

   Do not include `<injected-context>`, project memory, discussion artifacts, codebase evidence, existing recommendations, or another lane's output. Do not let a branch read or search the project. Use `scripts/forgeflow/render-research-divergence.js --task "<task>" --constraint "<constraint>" --json` to render deterministic packets when the checkout helper exists; otherwise resolve the same helper from the active host runtime. If it is unavailable, construct the same minimal packets manually and disclose that helper validation was skipped.
2. Launch all three fixed, isolated lanes in parallel:
   - **inversion:** assume the obvious approach fails; derive the opposite design and the conditions that make it work.
   - **remove-assumption:** remove one load-bearing assumption and derive a viable approach from the resulting constraint set.
   - **3am-on-call:** optimize for diagnosis, containment, and safe recovery by a tired on-call engineer.
3. In parallel with branch generation, run `atlas-early` on Claude or `atlas_early` on Codex with the normal preloaded codebase and memory context. This evidence lane must remain separate and must never message or provide context to a divergent branch.
4. Show the status of every divergent lane. Retry a missing, malformed, or failed lane once with the same packet. If it fails again, label that lane unavailable and the research `DEGRADED`; continue with successful lanes and never synthesize a replacement.
5. Spawn a separate Compass critic only after lane generation completes. On Claude use `compass-research`; on Codex use `compass_researcher`. Give the critic:
   - all successful lane outputs, labeled by frame
   - the normal `<injected-context>`, discussion, compact memory, Atlas/codebase evidence, accessibility context, and working directory
   - explicit instruction to criticize and converge, not generate another unconstrained list
6. Require the critic to emit:
   - clusters by underlying approach, including duplicated ideas and shared assumptions
   - a shortlist of two to four candidates
   - for each shortlisted candidate: **Strength**, **Attraction**, **Hidden trap and mechanism**, **Disconfirming test**, **Salvage condition**, and **First implementation step**
   - one **Non-obvious viable candidate**
   - **Load-bearing risk**, **First falsification experiment**, and **Final recommendation**

Raw lane prompts and outputs are ephemeral. Never save them to `current-research.md`, any memory/context file, `CONTEXT.md`, or another indexed artifact. Only the critic's converged decision content may proceed to the read-only presentation in Step 4. This boundary applies equally to Claude and Codex.

## Step 4: Present and save

Display Research Findings to the user. On the default route, save to `.forgeflow/<project-name>/current-research.md`. On the divergent route, do not write any file; return the converged findings only in the response.

For divergent research, include the route rationale, status of all three lanes, degraded status if applicable, clusters, shortlist and structured trap ledger, non-obvious viable candidate, falsification experiment, and final recommendation. Present only this converged content.

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
- [ ] On the default route, research saved to .forgeflow/ for reference
- [ ] For `--diverge`: branches received only task, immutable constraints, and one fixed frame
- [ ] For `--diverge`: lane failures were retried once and remain visible if unavailable
- [ ] For `--diverge`: no divergent content was saved or indexed
</success_criteria>
