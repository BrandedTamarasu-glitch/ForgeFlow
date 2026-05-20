---
name: forgeflow-learnings
description: Show current-project learning insights, or aggregate learnings.jsonl across projects for pattern promotion.
argument-hint: "[--project] [--check] [--period week|month|all] [--min-projects N] [--min-occurrences N] [--dry-run] [--json]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

<objective>
Default current-project mode refreshes `.forgeflow/<project>/project-learnings.md` and prints the actionable project insight summary: recurring pitfalls, stable decisions, risk areas, validation patterns, hot files, repeated follow-ups, and recommended next approach.

Cross-project mode reads per-project `.forgeflow/<project>/learnings.jsonl` files across the user's tree, clusters findings by type and keyword affinity to existing patterns, and either auto-updates `forgeflow-patterns/recurring-blockers.md` or surfaces NEW pattern candidates for user promotion.

Answers: "What failure modes are the Forgeflow team catching repeatedly, and which ones have grown into generalizable patterns worth writing into the canonical pattern library?"

Self-improving Forgeflow mechanic: runs monthly. `recurring-blockers.md`, `tooling-patterns.md`, `verdict-trends.md`, `auto-fix-patterns.md` grow organically from telemetry. Atlas and Arbiter read those files during `/plan`, `/consult`, `/review` — so promoting a pattern means every future review session now has it in context.
</objective>

<context>
$ARGUMENTS:
- `--project` — force current-project mode. This is the default when no cross-project promotion flags are present.
- `--check` — after refreshing current-project learnings, run the project-learnings quality check and show whether the artifact is safe to inject into agent context.
- `--period week|month|all` — window to include (default: all — this command is for rare, curated promotion, not weekly churn)
- `--min-projects N` — minimum distinct projects a cluster must appear in (default: 2)
- `--min-occurrences N` — minimum total occurrences across all projects (default: 3)
- `--dry-run` — report only. Do not write to `forgeflow-patterns/`. Always set this first until you trust the classification.
- `--json` — structured JSON output instead of markdown

## Data sources

Per-project structured learnings (primary):
- `.forgeflow/<project>/learnings.jsonl` — one JSON per line:
  ```
  {"date": "YYYY-MM-DD", "source": "<agent>", "type": "quality|efficiency|security|...", "learning": "<text>", "files": ["..."], "severity": "low|medium|high"}
  ```

Canonical pattern files (promotion targets):
- `forgeflow-patterns/recurring-blockers.md` — Tier A blocker classes (type safety, unimplemented features, null safety, ...)
- `forgeflow-patterns/tooling-patterns.md` — dev environment / tooling friction
- `forgeflow-patterns/verdict-trends.md` — reviewer verdict distribution signals
- `forgeflow-patterns/auto-fix-patterns.md` — what `/review-auto` tends to succeed or fail at

Telemetry aggregate (supplementary, not primary):
- `~/.claude/projects/<sanitized-cwd>/memory/forgeflow-metrics.jsonl` — counts only, not learning text
</context>

## Gotchas

- **Never overwrite an existing section.** When promoting a known pattern, ONLY update the `**Seen in:**` bullet list with new citations. Leave the pattern text, classification, and checks intact.
- **Never auto-append NEW patterns to recurring-blockers.md.** NEW patterns get a `## Candidates for promotion` block in the command output. User decides whether to write it in. This keeps the canonical file human-curated.
- **Classification is heuristic, not authoritative.** Keyword matching against existing pattern titles. If a learning could fit two patterns, report both candidates — don't guess.
- **Learnings files may be missing.** The command is best-effort across the filesystem. Missing files != zero learnings; surface any projects with >50 rounds in `review-history.md` but no `learnings.jsonl` as "uninstrumented".
- **Date filter on `date` field, not file mtime.** Learnings get appended with their own date; file mtime drifts if learnings are edited.

<process>

## Step 0: Current-project insight mode

Use this mode when the user wants to understand the current project after a few work items. It is the default unless the user passes cross-project promotion flags such as `--period`, `--min-projects`, or `--min-occurrences`.

Resolve paths:

```bash
PROJECT_NAME=$(basename "$(pwd)")
FORGEFLOW_DIR=".forgeflow/${PROJECT_NAME}"
HELPER_DIR="scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/show-project-learnings.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/show-project-learnings.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
```

If `${HELPER_DIR}/show-project-learnings.js` is missing, stop with:

```text
Project learnings helper is not installed. Run /update-forgeflow, then retry /forgeflow-learnings.
```

Refresh the local artifact and render the user-facing insight view:

```bash
"${HELPER_DIR}/show-project-learnings.js" --project-dir "${FORGEFLOW_DIR}"
```

If `--json` is present, pass `--json` and print the helper JSON directly.

If `--check` is present, resolve the quality helper:

```bash
if [ ! -x "${HELPER_DIR}/check-project-learnings.js" ]; then
  echo "Project learnings quality helper is not installed. Run /update-forgeflow, then retry /forgeflow-learnings --project --check."
  exit 1
fi
```

Then run:

```bash
"${HELPER_DIR}/check-project-learnings.js" --project-dir "${FORGEFLOW_DIR}"
```

For `--json --check`, return a single object with `learnings` from `show-project-learnings.js --json` and `check` from `check-project-learnings.js --json`. If the check status is `warn` or `fail`, call out that review context packs will block latest-insights injection until the reported issues are fixed or the rollup is refreshed.

Do not modify canonical `forgeflow-patterns/` files in current-project mode.

## Step 1: Discover cross-project learning sources

```bash
find "$HOME" -name "learnings.jsonl" -path "*/.forgeflow/*" -type f 2>/dev/null
```

Filter to files with at least 1 line. If zero files found, exit with:

```
No learnings found.

/forgeflow-learnings reads .forgeflow/<project>/learnings.jsonl files across your tree.
Atlas writes to these during /plan, /implement, and /review sessions.

If you've never run /review with the full Forgeflow on a real project, there's nothing
to learn from yet. Run /review on a real codebase first, then try again.
```

## Step 2: Load and filter learnings

For each `learnings.jsonl`:
- Parse each line (skip malformed lines silently)
- Apply period filter on the `date` field
- Record: `{project, date, source, type, learning, files, severity}`

Extract `project` from the path: `.forgeflow/<project>/learnings.jsonl` → `<project>`.

## Step 3: Cluster findings

### 3a. Load existing pattern titles

Read `forgeflow-patterns/recurring-blockers.md` and extract top-level headings (lines starting with `## ` but not `## Promotion criteria`). Build a list of canonical patterns:

```
["Type Safety & Schema Mismatches",
 "Unimplemented / Promised-But-Missing Features",
 "Null-Safety & Error-Path Gaps",
 ...]
```

Build keyword synonyms per pattern (inline in command; not a separate config):
- Type Safety → `enum, schema, type, drizzle, typescript, varchar, nullable, mismatch, signature`
- Unimplemented → `not implemented, missing, promised, declared but, not wired, TODO, unimplemented`
- Null-Safety → `null, nullable, undefined, NULL, unchecked, guard, assertion, throws, silent`

### 3b. Score each learning against each pattern

For each learning:
- Lowercase the `learning` text
- For each canonical pattern, count keyword matches
- Assign the pattern with the highest score, IF score >= 2 matches
- Else mark as `uncategorized`

Emit per (pattern, project) tallies and per uncategorized learning clusters (see Step 4).

### 3c. Cluster uncategorized learnings

Group uncategorized learnings by `type` field first, then by the first 5 significant words of `learning` (nouns only, naive stopword filter). Emit only clusters that hit `--min-occurrences` AND `--min-projects`.

## Step 4: Build promotion report

### 4a. Known-pattern updates (auto-apply)

For each canonical pattern with new citations (project not already listed under **Seen in:**):
- Output a proposed line: `  - \`<project>\` (learnings YYYY-MM-DD through YYYY-MM-DD) — <truncated 120-char summary from top learning>`
- If not `--dry-run`: apply via Edit — insert the new bullet into the existing **Seen in:** block of the matching `## <pattern>` section. Never touch other sections.

### 4b. NEW pattern candidates (manual review)

For each uncategorized cluster passing the thresholds, output:

```markdown
### Candidate: <auto-derived title from top keywords>

Threshold: appeared in <N> projects, <M> total occurrences, <max severity>

**Citations:**
- `<project1>` (YYYY-MM-DD) — "<learning text>"
- `<project2>` (YYYY-MM-DD) — "<learning text>"
- ...

**Suggested classification:** <BLOCKER | REVISE> (based on max severity in cluster)

**Promotion action (user runs manually):**
1. Choose a canonical pattern name
2. Decide the plan-time / implement-time / review-time preempt checks
3. Edit `forgeflow-patterns/recurring-blockers.md` and add the section
```

This output is the command's primary value for genuinely new patterns — the user curates the final text; the command surfaces what's ready to be curated.

## Step 5: Render output

If `--json`:

```json
{
  "period": "<period>",
  "projects_scanned": 7,
  "learnings_total": 428,
  "known_pattern_updates": [
    {
      "pattern": "Type Safety & Schema Mismatches",
      "new_projects": ["new-project-a"],
      "applied": true
    }
  ],
  "candidates": [
    {
      "title": "Missing retry/timeout on external API calls",
      "projects": ["proj-a", "proj-b"],
      "occurrences": 7,
      "max_severity": "high",
      "sample_learnings": [...]
    }
  ],
  "uninstrumented_projects": ["proj-c"]
}
```

If markdown (default):

```markdown
# Forgeflow Learnings — <period>

## Scan summary
- Projects scanned: 7
- Total learnings: 428
- Period: <start date> to <end date>

## Known pattern updates <applied | dry-run>
- **Type Safety & Schema Mismatches** — added citation for `new-project-a` (2026-04-03)
- **Null-Safety & Error-Path Gaps** — added citation for `new-project-b` (2026-04-12)

## Candidates for promotion (2)

### Candidate: Missing retry/timeout on external API calls
Threshold: 2 projects, 7 occurrences, max severity high

**Citations:**
- `proj-a` (2026-04-01) — "fetch call to /campaigns has no timeout, hangs indefinitely on network partition"
- `proj-b` (2026-04-08) — "stripe.charges.create lacks retry on 5xx; silently fails the order"

**Suggested classification:** BLOCKER

**Promotion action:** see recurring-blockers.md and add a new section following the existing schema.

### Candidate: ...

## Uninstrumented projects
- `proj-c` — has review history but no learnings.jsonl. Atlas may not have been dispatched on this project. Re-run /review with --full Forgeflow to populate.
```

## Step 6: Apply updates (if not `--dry-run`)

For each known-pattern update:
- Locate the `## <pattern>` heading
- Locate the `**Seen in:**` block within that section
- Insert the new citation line at the end of the existing bullets
- Preserve all surrounding formatting exactly

NEVER:
- Modify pattern text
- Remove existing citations
- Reorder sections
- Append NEW patterns to the file (always surface as candidate)

After writing, stage nothing. Commit is the user's decision.

## Step 7: Update self

Append a log line to the canonical log path (resolved similarly to Step 1: prefer `./forgeflow-patterns/` if cwd is Forgeflow, else `~/.claude/forgeflow-patterns/`). Target file: `<canonical-forgeflow-patterns-dir>/.learnings-log.jsonl` (create if missing):

```json
{"ts":"<ISO>","projects_scanned":N,"learnings_total":M,"updates_applied":K,"candidates":J}
```

This allows `/forgeflow-report` to show "last learnings run" without re-scanning.

Step 4a edits also target files in the resolved `forgeflow-patterns/` dir — NEVER write into a project's local `.forgeflow/` as a canonical target.

</process>

<success_criteria>
- [ ] Scanned every `.forgeflow/<project>/learnings.jsonl` under `$HOME` and reported the count
- [ ] Applied period + min-projects + min-occurrences filters correctly
- [ ] Known-pattern updates target only the existing `**Seen in:**` block of the matching section
- [ ] NEW candidates are surfaced, never auto-written
- [ ] `--dry-run` produces identical report output but makes zero file writes
- [ ] `--json` output is structurally valid (pipe into `jq .` without error)
- [ ] `.learnings-log.jsonl` gets a new entry on every non-dry-run invocation
- [ ] Uninstrumented projects surfaced separately from the main report
</success_criteria>
