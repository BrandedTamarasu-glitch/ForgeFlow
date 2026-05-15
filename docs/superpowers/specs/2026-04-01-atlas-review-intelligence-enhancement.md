# Atlas Review Intelligence Enhancement — Spec

**Date:** 2026-04-01
**Author:** Stress test debrief (Full Forgeflow synthetic PR, 2026-04-01)
**Status:** Ready for implementation

---

## Background

Atlas performed well in the V4.1.1 full Forgeflow stress test — correctly declared first run, raised no invented learnings, connected Smith's God Object finding to the broader architectural risk, and asked a strong JWT role verification question. Three gaps were identified:

1. **Coverage check evidence** — the Reviewer Coverage Check is a checkbox list. Atlas checked boxes without documenting which specific files each agent actually reviewed. A checked box does not prove coverage; it proves the agent was dispatched.
2. **Question severity tiers** — "Questions for Arbiter" has no tier system. Arbiter receives all questions at the same priority level and must triage them from scratch. Atlas is in a better position to pre-triage: she has read every agent's output and knows which questions block the verdict.
3. **Anti-performative question gate** — the rule "never ask a question you could answer by reading a file" exists in `<rules>` but it is behavioral enforcement only. In the stress test, one question was borderline performative — it could have been answered from the injected context. A structural pre-check step, not just a rule, reduces this drift.

---

## Gap 1: Coverage Check — Evidence Requirement

### Current behavior

```
#### Reviewer Coverage Check
- [ ] Smith reviewed all changed files for quality/design
- [ ] Warden reviewed all changed files for security/efficiency/reuse
- [ ] Lumen reviewed all frontend files for UX/UI/a11y (if applicable)
- [ ] No files missed by all reviewers
- [ ] Reviewers had all context they needed
```

A checkbox with no evidence. Atlas can tick all boxes without knowing whether Smith actually touched `auth.service.ts` or only reviewed the controller.

### New behavior

Each agent entry in the coverage check must include the files that agent actually reviewed, drawn from their output:

```
#### Reviewer Coverage Check

**Smith**
- [ ] Reviewed all changed files for quality/design
- Files reviewed: [list files Smith cited in their output, or "none cited — coverage unverifiable"]
- Files changed but not cited by Smith: [list, or "none — full coverage"]

**Warden**
- [ ] Reviewed all changed files for security/efficiency/reuse
- Files reviewed: [list files Warden cited in their output, or "none cited — coverage unverifiable"]
- Files changed but not cited by Warden: [list, or "none — full coverage"]

**Lumen** *(if frontend files exist)*
- [ ] Reviewed all frontend files for UX/UI/a11y
- Files reviewed: [list, or "none cited — coverage unverifiable"]
- Files changed but not cited by Lumen: [list, or "none — full coverage"]

**Coverage gaps:** [list any changed file not cited by any reviewer, or "none"]
```

**How to populate:** Atlas reads each agent's output and extracts file references. If an agent did not cite a specific file in their findings, that file is "not cited" — not confirmed reviewed. Coverage gaps surface to Arbiter automatically.

**Edge case:** If an agent's output contains no file:line citations at all, Atlas flags the agent's coverage as unverifiable and notes it in Efficiency Notes.

---

## Gap 2: Question Severity Tiers for "Questions for Arbiter"

### Current behavior

```
#### Questions for Arbiter
- Unresolved questions needing lead judgment
- Contradictions between reviewers
- Items where Atlas's fresh perspective disagrees with an expert
```

All questions arrive at Arbiter with equal priority. Arbiter spends the same cognitive effort on "is this naming consistent?" as on "does this pattern create a TOCTOU race condition?"

### New behavior

Every question must carry a severity tier before it is sent to Arbiter:

```
#### Questions for Arbiter

**BLOCK** *(must resolve before verdict)*
- [Q]: [question] — [why Atlas cannot resolve this from the reviewed code]

**REQUIRED** *(should resolve in this review cycle)*
- [Q]: [question] — [why Atlas cannot resolve this from the reviewed code]

**RECOMMENDED** *(low urgency — worth flagging, not blocking)*
- [Q]: [question] — [why Atlas cannot resolve this from the reviewed code]
```

**Tier definitions:**
- **BLOCK** — The question's answer could change whether a BLOCK verdict is warranted. If the answer is "yes", there is a blocker. Do not approve without this.
- **REQUIRED** — The question's answer could change a REVISE finding or a major recommendation. The review is incomplete without it.
- **RECOMMENDED** — The question is genuinely interesting but the answer cannot change the verdict tier. Raise it, but do not hold up the review for it.

**Anti-inflation rule:** Atlas must apply this honestly. A question that cannot affect the verdict tier is never BLOCK. If in doubt, tier down.

---

## Gap 3: Anti-Performative Question Gate (Structural Pre-Check)

### Current behavior

Rule exists: "Never ask a question you could answer by reading a file." This is behavioral enforcement — Atlas is expected to self-apply it. In the stress test, one question was borderline: it could have been resolved from the injected context but was raised anyway.

### New behavior

Add a structural pre-check step before the Questions for Arbiter section is written. This is not a rule to remember — it is a required output gate:

```
#### Question Pre-Check (complete before writing Questions for Arbiter)

For each candidate question, answer:
1. Is the answer present in the injected context, any agent's output, or a file I have already read?
   → If YES: answer it myself; do not ask Arbiter.
2. Is the answer derivable by reading a specific named file I have not yet read?
   → If YES: read the file; answer it myself; do not ask Arbiter.
3. Does the answer require information that is unavailable to any Forgeflow member from the code alone
   (runtime state, external config, product intent)?
   → If YES: this is a valid question. Include it with severity tier.

Questions that fail check 1 or 2 are dropped. Only questions that survive check 3 appear in
Questions for Arbiter.
```

**What changes in output:** The Question Pre-Check section is written as output (brief, 2–3 lines per dropped question noting why it was dropped). This makes the gate auditable — Arbiter can see what Atlas considered and discarded. It also creates a feedback loop: if Atlas keeps dropping the same class of question, that is a signal to add a lookup rule rather than repeating the check.

---

## Scope

**In scope:**
- Update `## Part 2: PM Status Report` output format in `atlas-review.md` — Coverage Check and Questions for Arbiter sections
- Add Question Pre-Check as a required gate before Questions for Arbiter
- Update `<rules>` in `atlas-review.md` to reference the new structural requirements
- Sync live `~/.claude/agents/atlas-review.md`

**Out of scope:**
- Changes to atlas-early, atlas-consult, atlas-implement, atlas-present
- Changes to any other Forgeflow agent
- Changes to memory file structure or learnings format
- Changes to the Creative Challenge or Memory Update sections

---

## Insertion Points

### atlas-review.md — Output Format (Part 2)

**Gap 1:** Replace the existing `#### Reviewer Coverage Check` block with the per-agent evidence format.

**Gap 2:** Replace the existing `#### Questions for Arbiter` block with the tiered version (BLOCK / REQUIRED / RECOMMENDED).

**Gap 3:** Insert `#### Question Pre-Check` as a new section immediately before `#### Questions for Arbiter`.

### atlas-review.md — Rules

**Gap 1:** Add rule: "In Reviewer Coverage Check, populate each agent's file list from their actual output citations. A checkbox without a file list is not evidence of coverage. If an agent cited no files, mark their coverage as unverifiable."

**Gap 2:** Add rule: "Every question in Questions for Arbiter must carry a severity tier: BLOCK, REQUIRED, or RECOMMENDED. A question that cannot affect the verdict tier is never BLOCK. If in doubt, tier down."

**Gap 3:** The existing rule `Never ask a question you could answer by reading a file` is superseded by the structural pre-check. Replace it with: "Before writing Questions for Arbiter, complete the Question Pre-Check. Only questions that survive check 3 (require information unavailable from the code) appear in that section. Include the pre-check output so Arbiter can audit what was dropped."

---

## Success Criteria

- `atlas-review.md` Reviewer Coverage Check format includes per-agent file citation evidence
- `atlas-review.md` Questions for Arbiter format includes BLOCK / REQUIRED / RECOMMENDED tiers
- `atlas-review.md` output format includes Question Pre-Check section before Questions for Arbiter
- `atlas-review.md` rules section updated: coverage rule, tier rule, pre-check rule (old behavioral rule superseded)
- Live `~/.claude/agents/atlas-review.md` matches repo agent exactly
- No changes made to any other agent file
