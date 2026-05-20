---
name: forgeflow-drift
description: Compare agent files against their canonical intelligence references in agents/_shared/. Report sections that are MISSING, DRIFTED, or MODIFIED. Surfaces agents whose prompts have fallen out of sync with the canonical source of truth.
argument-hint: "[--agent <name>] [--canonical <name>] [--threshold N (default 70)] [--json]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

<objective>
The Forgeflow team has four canonical intelligence references (`agents/_shared/*.md`) that are meant to be pasted (with light adaptation) into their respective agent files. Over time those pastes drift — the canonical file is updated, agent files lag. `/forgeflow-drift` detects that lag and surfaces which agents are out of sync.

Answers: "Which agent prompts have silently fallen behind their canonical reference?"

Self-improving Forgeflow mechanic: runs monthly alongside `/forgeflow-learnings`. Flags agents that need resync before they propagate stale guidance into future reviews.
</objective>

<context>
$ARGUMENTS:
- `--agent <name>` — check only one agent file (e.g., `arbiter-review`). Default: all agents.
- `--canonical <name>` — check only one canonical reference (e.g., `arbiter-intelligence`). Default: all four.
- `--threshold N` — section body similarity threshold (0-100) below which a section is classified DRIFTED rather than MODIFIED. Default: 70.
- `--json` — structured JSON instead of markdown.

## Canonical → agent mapping

Mapping is fixed in this command (not a config file). It reflects the deliberate wiring of each canonical reference to the agents that consume it:

| Canonical reference | Target agents |
|---|---|
| `agents/_shared/smith-craft.md` | `smith-consult`, `smith-implement`, `smith-audit`, `smith-review` |
| `agents/_shared/warden-security-intelligence.md` | `warden-consult`, `warden-implement`, `warden-audit`, `warden-review` |
| `agents/_shared/arbiter-intelligence.md` | `arbiter-consult`, `arbiter-implement`, `arbiter-review` |
| `agents/_shared/lumen-design-principles.md` | `lumen-consult`, `lumen-implement`, `lumen-review` |

Total mappings: 4 canonicals × avg 3.5 targets = 14 (canonical, agent) pairs per full run.
</context>

## Gotchas

- **Canonical files are reference-only.** They have frontmatter declaring them non-agents (`description: Canonical ... reference. Not an agent...`). Never dispatch a canonical as a subagent.
- **Partial adaptation is expected.** Agents do not paste the canonical verbatim; they adapt wording for their mode (consult vs review). A MODIFIED section is normal. Only MISSING or fully DRIFTED sections are actionable.
- **Frontmatter is not compared.** The agent's frontmatter is its own; only body sections (under `## ` headings) are scored.
- **Heading text must match exactly.** If the canonical renames a section from "Verdict Scale" to "Verdict Thresholds," every consuming agent will show MISSING for "Verdict Thresholds" until they resync. This is correct behavior — it surfaces the rename as actionable drift.
- **Section comparison is line-set Jaccard.** Not a full semantic diff. False positives possible when an agent uses different bullet wording for the same intent; accept this and use `--threshold 60` to relax if noisy.

<process>

## Step 0: Use the script-backed drift helper

Resolve `HELPER_DIR` to `scripts/forgeflow` when present, otherwise `$HOME/.claude/forgeflow/scripts/forgeflow`.

```bash
HELPER_DIR="scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/check-agent-drift.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/check-agent-drift.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
```

When `${HELPER_DIR}/check-agent-drift.js` exists, run it and print its output directly:

```bash
"${HELPER_DIR}/check-agent-drift.js" $ARGUMENTS
```

The helper owns section parsing, scoring, JSON/Markdown rendering, filtering, threshold handling, and actionable exit codes. If it is missing, continue with the manual fallback below and tell the user to run `/update-forgeflow` after the report.

## Step 1: Verify canonical files exist

Resolve the canonical and agent directories ONCE before any lookup:

```bash
# Prefer in-repo when running from Forgeflow; otherwise use the user install.
if [ -d "./agents/_shared" ] && [ -d "./agents" ]; then
  CANONICAL_DIR="./agents/_shared"
  AGENT_DIR="./agents"
else
  CANONICAL_DIR="$HOME/.claude/agents/_shared"
  AGENT_DIR="$HOME/.claude/agents"
fi

for canonical in smith-craft warden-security-intelligence arbiter-intelligence lumen-design-principles; do
  path="$CANONICAL_DIR/$canonical.md"
  [ -r "$path" ] || echo "MISSING CANONICAL: $path"
done
```

If any canonical is missing, report and continue with the available ones. `/forgeflow-drift` still adds value for the canonicals that exist.

## Step 2: Parse canonical sections

For each canonical file:
- Strip frontmatter (lines between first two `---` delimiters)
- Split body on `^## ` headings
- Extract `(heading, body)` pairs
- Normalize each body: lowercase, strip leading/trailing whitespace per line, drop blank lines, drop HTML comments

Store as: `canonicals[canonical_name] = [(heading, normalized_lines), ...]`

## Step 3: Parse target agents

For each target agent:
- Read `$AGENT_DIR/<agent>.md` (resolved in Step 1 — same prefer-repo logic)
- Same parsing: strip frontmatter, split on `## `, normalize

Store as: `agents[agent_name] = [(heading, normalized_lines), ...]`

## Step 4: Score each (canonical, agent) pair

For each pair:

```
agent_sections_by_heading = dict((h, body) for (h, body) in agents[agent])

for (heading, canonical_body) in canonicals[canonical]:
    if heading not in agent_sections_by_heading:
        status = "MISSING"
        similarity = 0
    else:
        agent_body = agent_sections_by_heading[heading]
        shared_lines = set(canonical_body) & set(agent_body)
        union_lines  = set(canonical_body) | set(agent_body)
        similarity = int(100 * len(shared_lines) / max(1, len(union_lines)))

        if canonical_body == agent_body:
            status = "SYNCED"
        elif similarity >= threshold:
            status = "MODIFIED"
        else:
            status = "DRIFTED"

    report.append({
        "canonical": canonical_name,
        "agent": agent_name,
        "section": heading,
        "status": status,
        "similarity": similarity
    })
```

`MISSING` and `DRIFTED` are actionable. `MODIFIED` and `SYNCED` are informational.

## Step 5: Aggregate per agent

```
# Pseudocode — orchestrator implements in-context; not literal code
total_sections = synced + modified + drifted + missing
if total_sections == 0:
    drift_score = 0   # empty canonical — nothing to compare
else:
    drift_score = (drifted * 2 + missing * 3) / total_sections

per_agent_summary[agent] = {
    "synced": synced,
    "modified": modified,
    "drifted": drifted,
    "missing": missing,
    "drift_score": drift_score
}
```

Sort agents by `drift_score` descending — highest drift first.

## Step 6: Render output

If `--json`:

```json
{
  "threshold": 70,
  "checked": {
    "canonicals": 4,
    "agents": 14,
    "section_comparisons": 112
  },
  "per_agent": [
    {
      "agent": "arbiter-consult",
      "canonical": "arbiter-intelligence",
      "drift_score": 0.14,
      "synced": 9,
      "modified": 2,
      "drifted": 1,
      "missing": 0,
      "sections": [
        {"section": "Verdict Scale", "status": "SYNCED", "similarity": 100},
        {"section": "Scope Gate", "status": "DRIFTED", "similarity": 42}
      ]
    }
  ]
}
```

If markdown (default):

```markdown
# Forgeflow Drift Report

## Scan
- Canonicals: 4 (smith-craft, warden-security-intelligence, arbiter-intelligence, lumen-design-principles)
- Agents: 14
- Section comparisons: 112
- Threshold: 70% similarity

## Summary
| Agent | Canonical | Synced | Modified | Drifted | Missing |
|---|---|---|---|---|---|
| arbiter-review | arbiter-intelligence | 8 | 2 | 1 | 1 |
| smith-audit | smith-craft | 10 | 4 | 0 | 2 |
| ... | ... | ... | ... | ... | ... |

## Actionable drift

### arbiter-review (drift_score: 0.21)
- **MISSING**: `Scope Gate` — section present in canonical, absent in agent
- **DRIFTED**: `Verdict Scale` — 38% similarity; canonical has added "CONDITIONAL APPROVE" row, agent still uses old 4-verdict scale

  Fix: copy the `## Verdict Scale` section from `agents/_shared/arbiter-intelligence.md` into `agents/arbiter-review.md`.

### smith-audit (drift_score: 0.18)
- **MISSING**: `Performance Review Checklist`
- **MISSING**: `Database Pattern Audit`

  Fix: copy both sections from `agents/_shared/smith-craft.md` into `agents/smith-audit.md`.

## Informational (not actionable)

### warden-consult
- 6 sections SYNCED, 3 MODIFIED. No drift above threshold.

## Recommendation
1. Fix MISSING sections first — these are strict regressions.
2. Fix DRIFTED sections second — the canonical has diverged meaningfully.
3. MODIFIED is expected adaptation; only investigate if drift_score > 0.30.
```

## Step 7: Exit code

- Exit 0 if no actionable drift (no MISSING, no DRIFTED)
- Exit 1 if actionable drift exists — lets CI wire `/forgeflow-drift` as a gate

</process>

<success_criteria>
- [ ] All four canonical references located and parsed
- [ ] Script-backed helper path is used when available
- [ ] All 14 target agents parsed (or fewer when `--agent` filter set)
- [ ] Each (canonical, agent) pair produces per-section status (SYNCED | MODIFIED | DRIFTED | MISSING)
- [ ] Actionable drift (MISSING, DRIFTED) rendered with specific fix instructions per section
- [ ] `--json` output structurally valid and parseable
- [ ] Exit code reflects actionable drift presence
- [ ] Threshold is configurable at command line
</success_criteria>
