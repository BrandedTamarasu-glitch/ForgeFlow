# Arbiter Architect Intelligence Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `## Lead Architect Intelligence` section to the canonical `arbiter-intelligence.md` and paste it into all three Arbiter mode agents, giving Arbiter three named epistemological protocols that govern how he evaluates findings, handles convergence, and validates verdicts before output.

**Architecture:** Gap 6 only — all other gaps (1–5, 7) are already implemented. The canonical `_shared/arbiter-intelligence.md` is the source of truth; agents get the section pasted with a `<!-- sourced from -->` comment. Protocol 1 (Finding Validity Pre-Check) goes into all three agents. Protocols 2 and 3 go into arbiter-review.md only.

**Tech Stack:** Markdown file editing only — no code, no tests, no build step.

---

## File Map

| Action | File |
|--------|------|
| Modify | `~/Claude/Work/Forgeflow/agents/_shared/arbiter-intelligence.md` |
| Modify | `~/Claude/Work/Forgeflow/agents/arbiter-review.md` |
| Modify | `~/Claude/Work/Forgeflow/agents/arbiter-consult.md` |
| Modify | `~/Claude/Work/Forgeflow/agents/arbiter-implement.md` |
| Sync | `~/.claude/agents/arbiter-review.md` |
| Sync | `~/.claude/agents/arbiter-consult.md` |
| Sync | `~/.claude/agents/arbiter-implement.md` |
| Sync | `~/.claude/agents/arbiter-intelligence.md` |
| Modify | `~/Claude/Work/Forgeflow/docs/arbiter.md` |
| Create | `~/Claude/Work/Forgeflow/docs/changelogs/v4.1.html` |
| Modify | `~/Claude/Work/Forgeflow/README.md` |

---

## The Intelligence Block (canonical content — do not abbreviate)

This is the exact content added to the canonical file and pasted into each agent. Copy verbatim.

### Full block (all three protocols — for arbiter-review.md)

```markdown
<!-- sourced from _shared/arbiter-intelligence.md — update canonical first -->
## Lead Architect Intelligence

Three named protocols Arbiter applies during synthesis. Applied in order: Finding Validity Pre-Check first, then Cross-Agent Convergence Check during pressure-testing, then Verdict Integrity Check before outputting the verdict.

### Protocol 1: Finding Validity Pre-Check

Applied before synthesis — after the Blocked Findings pass, before pressure-testing. For each confirmed (non-blocked) finding:

1. **Grounding check:** Is this finding grounded in a specific `file:line` in the code under review — not a heuristic that matches anything roughly similar?
2. **Severity consistency check:** Is the severity label consistent with the evidence in the finding body? A finding body that says "this could theoretically cause X" does not support a blocker label.
3. **Resolvability check:** Does confirming this finding require information not in the reviewed code (caller behavior, runtime state, external config)?

**On failure:**
- Fail check 1 → downgrade one tier (blocker → required, required → recommended) or drop if already at recommended.
- Fail check 2 → recalibrate severity to match evidence. Do not re-escalate without new evidence.
- Fail check 3 → route to `## Blocked Findings — Awaiting Context`.

### Protocol 2: Cross-Agent Convergence Check

Applied during pressure-testing — when 3 or more agents flag what appears to be the same finding.

1. Identify the **specific `file:line`** each agent cited.
2. Different lines + same label → independent findings, not confirmation. Each stands on its own evidence. Do not aggregate severity.
3. Same line cited by all → real convergence. Apply Finding Validity Pre-Check to the merged finding before elevation.

**The trap:** Unanimous label agreement without shared code evidence is pattern-matching, not confirmation. Treat as one unverified heuristic — not N independent verifications.

### Protocol 3: Verdict Integrity Check

Applied after synthesis, before outputting the verdict.

1. List every confirmed defect that anchored the current verdict tier.
2. For each: did any part of the review body walk it back, qualify it, or reduce its severity?
3. If yes → recalibrate the verdict before output. A verdict anchored by a finding subsequently walked back in the same pass is not a valid verdict.
```

### Protocol 1 only block (for arbiter-consult.md and arbiter-implement.md)

```markdown
<!-- sourced from _shared/arbiter-intelligence.md — update canonical first -->
## Lead Architect Intelligence

### Protocol 1: Finding Validity Pre-Check

Applied to each finding before including it in brief decisions (consult) or deviation classification (implement). For each finding:

1. **Grounding check:** Is this finding grounded in a specific `file:line` in the code under review — not a heuristic that matches anything roughly similar?
2. **Severity consistency check:** Is the severity label consistent with the evidence in the finding body? A finding body that says "this could theoretically cause X" does not support a blocker label.
3. **Resolvability check:** Does confirming this finding require information not in the reviewed code (caller behavior, runtime state, external config)?

**On failure:**
- Fail check 1 → downgrade one tier or drop if already at recommended.
- Fail check 2 → recalibrate severity to match evidence.
- Fail check 3 → route to `## Blocked Findings — Awaiting Context`.

Protocols 2 and 3 (Cross-Agent Convergence Check, Verdict Integrity Check) are review-specific — see arbiter-review.md.
```

---

## Task 1: Add Lead Architect Intelligence to canonical arbiter-intelligence.md

**Files:**
- Modify: `~/Claude/Work/Forgeflow/agents/_shared/arbiter-intelligence.md`

- [ ] **Step 1: Read the canonical file**

Read `~/Claude/Work/Forgeflow/agents/_shared/arbiter-intelligence.md` and confirm it ends with the `## Rejected Alternatives Log` section (lines ~77–84).

- [ ] **Step 2: Append the full Lead Architect Intelligence block**

Append after the `## Rejected Alternatives Log` section. The section to add (no `<!-- sourced -->` comment in the canonical — that comment is only in agent files):

```markdown
## Lead Architect Intelligence

Three named protocols Arbiter applies during synthesis. Applied in order: Finding Validity Pre-Check first, then Cross-Agent Convergence Check during pressure-testing, then Verdict Integrity Check before outputting the verdict.

### Protocol 1: Finding Validity Pre-Check

Applied before synthesis — after the Blocked Findings pass, before pressure-testing. For each confirmed (non-blocked) finding:

1. **Grounding check:** Is this finding grounded in a specific `file:line` in the code under review — not a heuristic that matches anything roughly similar?
2. **Severity consistency check:** Is the severity label consistent with the evidence in the finding body? A finding body that says "this could theoretically cause X" does not support a blocker label.
3. **Resolvability check:** Does confirming this finding require information not in the reviewed code (caller behavior, runtime state, external config)?

**On failure:**
- Fail check 1 → downgrade one tier (blocker → required, required → recommended) or drop if already at recommended.
- Fail check 2 → recalibrate severity to match evidence. Do not re-escalate without new evidence.
- Fail check 3 → route to `## Blocked Findings — Awaiting Context`.

### Protocol 2: Cross-Agent Convergence Check

Applied during pressure-testing — when 3 or more agents flag what appears to be the same finding.

1. Identify the **specific `file:line`** each agent cited.
2. Different lines + same label → independent findings, not confirmation. Each stands on its own evidence. Do not aggregate severity.
3. Same line cited by all → real convergence. Apply Finding Validity Pre-Check to the merged finding before elevation.

**The trap:** Unanimous label agreement without shared code evidence is pattern-matching, not confirmation. Treat as one unverified heuristic — not N independent verifications.

### Protocol 3: Verdict Integrity Check

Applied after synthesis, before outputting the verdict.

1. List every confirmed defect that anchored the current verdict tier.
2. For each: did any part of the review body walk it back, qualify it, or reduce its severity?
3. If yes → recalibrate the verdict before output. A verdict anchored by a finding subsequently walked back in the same pass is not a valid verdict.
```

- [ ] **Step 3: Verify**

Read the file back and confirm:
- `## Lead Architect Intelligence` appears after `## Rejected Alternatives Log`
- All three Protocol subsections are present
- The "On failure" action list is correct under Protocol 1
- The "The trap" callout is present in Protocol 2
- The three numbered steps are present in Protocol 3

---

## Task 2: Update arbiter-review.md — insert section + update process steps + add rule

**Files:**
- Modify: `~/Claude/Work/Forgeflow/agents/arbiter-review.md`

- [ ] **Step 1: Read arbiter-review.md**

Confirm current state: `## Verdict Scale` ends around line 73, followed immediately by `## Mode: Review` at line 74.

- [ ] **Step 2: Insert the full Lead Architect Intelligence block**

Insert between `## Verdict Scale` (after the closing table row at line 73) and `## Mode: Review`. Use the **full block (all three protocols)** from the File Map above, including the `<!-- sourced -->` comment.

The exact insertion point: after this line:
```
| BLOCK | Confirmed critical or security defect | Finding is unconfirmed |
```
And before:
```
## Mode: Review
```

- [ ] **Step 3: Update the process steps**

The current process section reads:
```
1. **Read all reviews** — parse completely before forming opinion
1.5. **Blocked Findings pass** — For each finding in the reviews, determine: can the agent who raised it confirm it from their visible code? ...
2. **Read flagged code** — form your own understanding
3. **Pressure-test findings** — are they real? Would fixes conflict?
4. **Synthesize** — one consolidated review with clear priority tiers
```

Replace with:
```
1. **Read all reviews** — parse completely before forming opinion
1.5. **Blocked Findings pass** — For each finding in the reviews, determine: can the agent who raised it confirm it from their visible code? If yes, it is confirmed regardless of whether Arbiter can independently verify it. If the raising agent lacked the file in context, apply the three gates (specificity bar, numeric cap, positive indicator) and route to `## Blocked Findings — Awaiting Context`. Only confirmed findings proceed to pressure-testing.
1.75. **Finding Validity Pre-Check** — Apply Protocol 1 (Lead Architect Intelligence) to each confirmed finding: (1) grounding check, (2) severity consistency check, (3) resolvability check. Downgrade or block failing findings before pressure-testing.
2. **Read flagged code** — form your own understanding
3. **Pressure-test findings** — are they real? Would fixes conflict? Apply Protocol 2 (Cross-Agent Convergence Check) when 3+ agents flag the same finding — verify each cited a common `file:line` before treating as confirmation.
4. **Synthesize** — one consolidated review with clear priority tiers. Apply Protocol 3 (Verdict Integrity Check) before outputting the verdict: confirm no anchoring defect was walked back in the same review body.
```

- [ ] **Step 4: Add rule to `<rules>` block**

Add after the existing rule about "When applying the conflict resolution hierarchy...":
```
- Apply the Lead Architect Intelligence protocols in order: (1) Finding Validity Pre-Check on each confirmed finding after the Blocked Findings pass — grounding check, severity consistency check, resolvability check; (2) Cross-Agent Convergence Check when 3+ agents flag the same finding — verify shared file:line before treating as confirmation; (3) Verdict Integrity Check after synthesis — list anchoring defects and confirm none were walked back before outputting the verdict.
```

- [ ] **Step 5: Verify**

Read the file back and confirm:
- `## Lead Architect Intelligence` appears between `## Verdict Scale` and `## Mode: Review`
- Process step 1.75 references Protocol 1 by name
- Process step 3 references Protocol 2 by name
- Process step 4 references Protocol 3 by name
- The new rule appears in the `<rules>` block

---

## Task 3: Update arbiter-consult.md — insert Protocol 1 + update process + add rule

**Files:**
- Modify: `~/Claude/Work/Forgeflow/agents/arbiter-consult.md`

- [ ] **Step 1: Read arbiter-consult.md**

Confirm current state: `## Rejected Alternatives Log` ends around line 77, followed by `## Mode: Consult` at line 79.

- [ ] **Step 2: Insert Protocol 1 only block**

Insert between the `## Rejected Alternatives Log` section and `## Mode: Consult`. Use the **Protocol 1 only block** from the File Map above, including the `<!-- sourced -->` comment.

The exact insertion point: after this line:
```
| [example row — remove before use] | [agent] | [one-line reason] |
```
And before:
```
## Mode: Consult
```

- [ ] **Step 3: Update the process steps**

The current process section reads:
```
1. **Read all agent briefs** before forming your own view
1.5. **Scope Gate** — ...
2. **Resolve conflicts** ...
```

Replace step 1.5 and add step 1.75:
```
1. **Read all agent briefs** before forming your own view
1.5. **Scope Gate** — Before resolving conflicts, apply the three-check scope gate: (1) Does any brief propose work not in the feature request or prior brief? Name it and require justification. (2) Does any change affect components outside scope? Requires explicit approval. (3) Has total scope grown? Log the delta in `## Rejected Alternatives` or promote to a separate brief.
1.75. **Finding Validity Pre-Check** — Apply Protocol 1 (Lead Architect Intelligence) to each finding in the agent briefs: (1) grounding check, (2) severity consistency check, (3) resolvability check. Downgrade, drop, or route to Blocked Findings before including findings in scope or brief decisions.
2. **Resolve conflicts** — if Smith wants pattern X but Warden says it creates a security risk, you decide
3. **Validate scope division** — is Atlas's scope proposal clean? Any gaps? Any overlaps?
4. **Define shared interfaces** — lock down contracts between agents before parallel work starts
5. **Set implementation order** — what must be built first? What can be parallel?
6. **Produce the Implementation Brief**
```

- [ ] **Step 4: Add rule to `<rules>` block**

Add after the rule "Decisions Made resolutions must cite the conflict resolution hierarchy tier used...":
```
- Apply Finding Validity Pre-Check (Protocol 1 from Lead Architect Intelligence) to each finding in agent briefs before including it in brief decisions: grounding check, severity consistency check, resolvability check. Downgrade or block findings that fail.
```

- [ ] **Step 5: Verify**

Read the file back and confirm:
- `## Lead Architect Intelligence` with Protocol 1 only appears between `## Rejected Alternatives Log` and `## Mode: Consult`
- Process step 1.75 references Protocol 1 by name
- The note about Protocols 2 and 3 being review-specific is present
- New rule appears in `<rules>`

---

## Task 4: Update arbiter-implement.md — insert Protocol 1 + add rule

**Files:**
- Modify: `~/Claude/Work/Forgeflow/agents/arbiter-implement.md`

- [ ] **Step 1: Read arbiter-implement.md**

Confirm current state: `## Deviation Protocol` ends around line 53, followed by `## Mode: Implement` at line 55.

- [ ] **Step 2: Insert Protocol 1 only block**

Insert between `## Deviation Protocol` and `## Mode: Implement`. Use the **Protocol 1 only block** from the File Map above, including the `<!-- sourced -->` comment.

The exact insertion point: after this line:
```
3. **Path 3 — Deviation reveals brief flaw:** The brief is amended in-place (never versioned to a new file). A `## Amendment Log` entry is appended with the fields: date | triggering wave | what changed | downstream waves affected. Agents not yet mid-execution read the amended brief automatically; agents mid-execution must re-read the brief before finalizing output. The orchestrator or human determines whether completed waves need re-execution — Arbiter does not decide unilaterally.
```
And before:
```
## Mode: Implement
```

- [ ] **Step 3: Add rule to `<rules>` block**

Add after the rule "Before marking any agent's Brief Compliance as 'followed'...":
```
- Apply Finding Validity Pre-Check (Protocol 1 from Lead Architect Intelligence) when classifying a deviation: a deviation grounded only in a heuristic match, not a specific file:line, is not a valid Path 3 trigger. Downgrade to Path 1 or Path 2.
```

- [ ] **Step 4: Verify**

Read the file back and confirm:
- `## Lead Architect Intelligence` with Protocol 1 only appears between `## Deviation Protocol` and `## Mode: Implement`
- New rule appears in `<rules>`
- The note about Protocols 2 and 3 being review-specific is present

---

## Task 5: Sync live agents at ~/.claude/agents/

**Files:**
- Sync: `~/.claude/agents/arbiter-intelligence.md`
- Sync: `~/.claude/agents/arbiter-review.md`
- Sync: `~/.claude/agents/arbiter-consult.md`
- Sync: `~/.claude/agents/arbiter-implement.md`

- [ ] **Step 1: Copy all four files**

```bash
cp ~/Claude/Work/Forgeflow/agents/_shared/arbiter-intelligence.md ~/.claude/agents/arbiter-intelligence.md
cp ~/Claude/Work/Forgeflow/agents/arbiter-review.md ~/.claude/agents/arbiter-review.md
cp ~/Claude/Work/Forgeflow/agents/arbiter-consult.md ~/.claude/agents/arbiter-consult.md
cp ~/Claude/Work/Forgeflow/agents/arbiter-implement.md ~/.claude/agents/arbiter-implement.md
```

- [ ] **Step 2: Spot-check one file**

Run:
```bash
grep -n "Lead Architect Intelligence" ~/.claude/agents/arbiter-review.md
```
Expected: at least 4 matches (section header + 3 protocol subsection headers).

Run:
```bash
grep -n "Lead Architect Intelligence" ~/.claude/agents/arbiter-consult.md ~/.claude/agents/arbiter-implement.md
```
Expected: at least 2 matches per file (section header + Protocol 1 header).

---

## Task 6: Update docs/arbiter.md

**Files:**
- Modify: `~/Claude/Work/Forgeflow/docs/arbiter.md`

- [ ] **Step 1: Update verdict line**

Line 76 currently reads:
```
**Verdict:** APPROVE / REVISE / BLOCK
```

Replace with:
```
**Verdict:** APPROVE / CONDITIONAL APPROVE / REVISE / BLOCK
```

- [ ] **Step 2: Add Lead Architect Intelligence section to hard rules**

The "Hard rules" section in the Review Mode description (lines 79–85) ends with:
```
- Keeps output concise and actionable — readable in under 5 minutes
```

Add after:
```
- Applies three Lead Architect Intelligence protocols before output: (1) Finding Validity Pre-Check — grounding, severity consistency, resolvability on each confirmed finding; (2) Cross-Agent Convergence Check — verify shared file:line before treating 3+ agent agreement as confirmation; (3) Verdict Integrity Check — confirm no anchoring defect was walked back before outputting the verdict.
```

- [ ] **Step 3: Verify**

Read the file back and confirm the verdict line includes CONDITIONAL APPROVE and the three protocols appear in Hard Rules.

---

## Task 7: Write v4.1 changelog

**Files:**
- Create: `~/Claude/Work/Forgeflow/docs/changelogs/v4.1.html`

- [ ] **Step 1: Read v4.0.html as template**

Read `~/Claude/Work/Forgeflow/docs/changelogs/v4.0.html` — use it as the structural template (nav links, CSS class names, header format).

- [ ] **Step 2: Write v4.1.html**

Create `~/Claude/Work/Forgeflow/docs/changelogs/v4.1.html` using the same HTML structure. Content:

- **Version:** V4.1
- **Date:** 2026-04-01
- **Title:** Arbiter Architect Intelligence Layer
- **Summary:** Adds the Lead Architect Intelligence section to Arbiter — three named protocols that govern how he evaluates findings, handles convergence, and validates verdicts before output. Closes the final gap (Gap 6) from the 2026-04-01 Atlas consultation.
- **Changes:**
  1. **Protocol 1: Finding Validity Pre-Check** — Before synthesis (all three modes): grounding check, severity consistency check, resolvability check on each confirmed finding. Downgrade or block on failure.
  2. **Protocol 2: Cross-Agent Convergence Check** — During pressure-testing (review mode): when 3+ agents flag the same finding, verify shared file:line before treating as confirmation. Different lines = independent findings, not convergence.
  3. **Protocol 3: Verdict Integrity Check** — After synthesis (review mode): list anchoring defects, confirm none were walked back in the same pass before outputting verdict.
  4. **Canonical file updated:** `_shared/arbiter-intelligence.md` is the source of truth for all Arbiter intelligence sections.
  5. **docs/arbiter.md:** Verdict scale updated to include CONDITIONAL APPROVE; Lead Architect Intelligence listed in hard rules.

- [ ] **Step 3: Update nav links**

In v4.1.html, the "Previous" link points to v4.0.html. In v4.0.html, add/update the "Next" link to point to v4.1.html.

---

## Task 8: Update README.md

**Files:**
- Modify: `~/Claude/Work/Forgeflow/README.md`

- [ ] **Step 1: Read the changelog section of README.md**

Find where the version history is listed (should be near the top, V4.0 was the most recent entry).

- [ ] **Step 2: Prepend V4.1 entry**

Add before the existing V4.0 entry:
```
- **[V4.1](docs/changelogs/v4.1.html)** — Arbiter Architect Intelligence Layer (Finding Validity Pre-Check, Cross-Agent Convergence Check, Verdict Integrity Check)
```

- [ ] **Step 3: Verify**

Read the README changelog section and confirm V4.1 appears before V4.0.

---

## Self-Review

### Spec coverage check
- Gap 6 Protocol 1 (Finding Validity Pre-Check): Tasks 1–4 ✓
- Gap 6 Protocol 2 (Cross-Agent Convergence Check): Tasks 1–2 ✓ (review only — correct per spec)
- Gap 6 Protocol 3 (Verdict Integrity Check): Tasks 1–2 ✓ (review only — correct per spec)
- Canonical file: Task 1 ✓
- Live sync: Task 5 ✓
- docs/arbiter.md: Task 6 ✓
- Changelog: Task 7 ✓
- README: Task 8 ✓

### Out-of-scope confirmation
- No changes to Smith, Warden, Lumen, Compass, or Atlas agents
- No changes to arbiter-intelligence.md sections already implemented (Gaps 1–5, 7)
- No new output sections added (Blocked Findings table already handles Protocol 1 overflow)

### Placeholder scan
No TBDs, todos, or "similar to above" references. All content is fully specified.
