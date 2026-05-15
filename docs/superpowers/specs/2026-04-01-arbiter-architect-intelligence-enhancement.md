# Arbiter Architect Intelligence Enhancement — Spec

**Date:** 2026-04-01
**Author:** Atlas (consultation), written to spec 2026-04-01
**Status:** Ready for implementation

---

## Background

Arbiter received seven gap fixes from a Atlas consultation on 2026-04-01. Gaps 1–5 and 7 are implemented in the canonical `_shared/arbiter-intelligence.md` and pasted into all three mode agents. **Gap 6 — Lead Architect Intelligence Layer — is the sole remaining unimplemented gap.**

The other Forgeflow leads have named epistemological frameworks:
- Smith has **Craft Intelligence** (smell taxonomy, naming precision, SOLID deep cuts)
- Warden has **Security Intelligence** (threat model, severity tiers, OWASP application)
- Lumen has **Design Voice** (aesthetic principles, accessibility rules, connectivity patterns)

Arbiter has none. Gap 6 adds it.

---

## Gap 6: Lead Architect Intelligence Layer

Three named protocols that Arbiter applies during review synthesis. Analogous to Smith's Craft Intelligence — not a checklist to run once, but a permanent part of how Arbiter thinks.

### Protocol 1: Finding Validity Pre-Check

Applied **before synthesis** — after the Blocked Findings pass, before pressure-testing.

For each confirmed (non-blocked) finding, answer three questions:

1. **Grounding check:** Is this finding grounded in a specific line or symbol in the code under review — not a heuristic that matches anything roughly similar?
2. **Severity consistency check:** Is the severity label (blocker / required / recommended) consistent with the evidence stated in the finding body? A finding body that says "this could theoretically cause X" does not support a blocker label.
3. **Resolvability check:** Does confirming this finding require information that is not in the reviewed code (caller behavior, runtime state, external config)?

**Action on failure:**
- Fail check 1 → downgrade one tier (blocker → required, required → recommended) or drop if already at recommended
- Fail check 2 → recalibrate severity to match evidence; do not escalate back without new evidence
- Fail check 3 → route to `## Blocked Findings — Awaiting Context` (per existing Blocked Findings Protocol)

### Protocol 2: Cross-Agent Convergence Check

Applied **during pressure-testing** — when 3 or more agents flag what appears to be the same finding.

1. Identify the **specific file:line** each agent cited for the finding.
2. If agents cited different lines under the same label → treat as **independent findings**, not confirmation. Each stands or falls on its own evidence. Do not aggregate severity.
3. If agents cited the same line → convergence is real; apply the Finding Validity Pre-Check to the merged finding before elevation.

**The trap this prevents:** Unanimous consensus on a label (e.g., "missing transaction") without shared code evidence is pattern-matching, not confirmation. Treat it as a single unverified heuristic, not N independent verifications.

### Protocol 3: Verdict Integrity Check

Applied **after synthesis, before outputting the verdict**.

1. List every confirmed defect that anchored the current verdict tier (BLOCK / REVISE / APPROVE).
2. For each anchoring defect: did any part of the review body walk it back, qualify it, or reduce its severity?
3. If yes → recalibrate the verdict tier before output. A verdict anchored by a finding that was subsequently walked back in the same pass is not a valid verdict.

---

## Scope

**In scope:**
- Add `## Lead Architect Intelligence` section to `_shared/arbiter-intelligence.md`
- Paste the full section into `arbiter-review.md` (all three protocols apply)
- Paste Finding Validity Pre-Check into `arbiter-consult.md` (applies when evaluating agent briefs before synthesis)
- Paste Finding Validity Pre-Check into `arbiter-implement.md` (applies when spot-checking agent output for deviation classification)
- Update process step references in each agent to cite the new protocols by name
- Sync live `~/.claude/agents/arbiter-{consult,implement,review}.md`
- Update `docs/arbiter.md` Core Capabilities table
- Write changelog entry

**Out of scope:**
- Changes to any other Forgeflow agent
- Changes to `arbiter-intelligence.md` sections already implemented (Gaps 1–5, 7)
- New output sections (the existing `## Blocked Findings — Awaiting Context` table handles Protocol 1 overflow)

---

## Insertion Points (per agent)

### arbiter-intelligence.md (canonical)
Insert `## Lead Architect Intelligence` as a new section after `## Rejected Alternatives Log`.

### arbiter-review.md
- Insert `<!-- sourced from _shared/arbiter-intelligence.md — update canonical first -->` + `## Lead Architect Intelligence` block after the `## Verdict Scale` section and before `## Mode: Review`.
- Update process step references:
  - After step 1.5 (Blocked Findings pass): add step 1.75 referencing Finding Validity Pre-Check
  - Step 3 (Pressure-test): append note to apply Cross-Agent Convergence Check
  - Step 4 (Synthesize): append note to apply Verdict Integrity Check before output
- Add rule: "Apply the Lead Architect Intelligence protocols in order: Finding Validity Pre-Check on each confirmed finding, Cross-Agent Convergence Check on any 3+ agent convergence, Verdict Integrity Check before outputting the verdict."

### arbiter-consult.md
- Insert `<!-- sourced from _shared/arbiter-intelligence.md — update canonical first -->` + `## Lead Architect Intelligence` block (Finding Validity Pre-Check only — the other two are review-specific) after `## Rejected Alternatives Log` and before `## Mode: Consult`.
- Update process: after step 1.5 (Scope Gate), add step 1.75: "Apply Finding Validity Pre-Check to each finding in the agent briefs."
- Add rule: "Apply Finding Validity Pre-Check to each finding in agent briefs before including it in scope or brief decisions."

### arbiter-implement.md
- Insert `<!-- sourced from _shared/arbiter-intelligence.md — update canonical first -->` + `## Lead Architect Intelligence` block (Finding Validity Pre-Check only) after `## Deviation Protocol` and before `## Mode: Implement`.
- Add rule: "Apply Finding Validity Pre-Check when classifying a deviation — a deviation grounded only in a heuristic match, not specific code evidence, is not a valid Path 3 trigger."

---

## Success Criteria

- `arbiter-intelligence.md` contains `## Lead Architect Intelligence` with all three protocols
- All three mode agents contain the section (scoped as above)
- Process steps in each agent reference the protocols by name at the correct point in the workflow
- Rules sections in each agent include the enforcement rule
- Live agents at `~/.claude/agents/` match the repo agents exactly
- `docs/arbiter.md` reflects the addition
- Changelog written at `docs/changelogs/v4.1.html` (or next version after Smith's v4.0)
