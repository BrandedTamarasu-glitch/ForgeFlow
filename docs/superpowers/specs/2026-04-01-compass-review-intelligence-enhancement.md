# Compass Review Intelligence Enhancement — Spec

**Date:** 2026-04-01
**Author:** Stress test debrief (Full Forgeflow synthetic PR, 2026-04-01)
**Status:** Ready for implementation

---

## Background

Compass performed strongly in the V4.1.1 full Forgeflow stress test — correctly declared cold-review, added genuine strategic layer (spec failure framing, business risk framing of a11y), and passed the auth security scenario. Three gaps were identified:

1. **Process gate framing** — when no plan exists AND the feature is auth/security/compliance, Compass produced the right content but buried it in strategic notes rather than surfacing it as a top-level output section. Users and Arbiter miss it.
2. **Requirements Coverage rigor** — "criteria never defined" and "criteria defined but not met" are different findings with different severities. Compass currently handles both under Requirements Coverage without distinguishing them. Missing criteria is a planning failure upstream; unmet criteria is an implementation failure. Conflating them obscures where the root cause lives.
3. **CHALLENGE grounding** — Compass can raise a CHALLENGE item without citing the specific file:line or gap it is grounded in. This creates the same false positive risk that Arbiter's Protocol 1 was designed to prevent. A CHALLENGE not grounded in evidence is a heuristic opinion, not a review finding.

---

## Gap 1: Pre-Implementation Gate (Top-Level Output Section)

### When it fires

Compass must output a `## Pre-Implementation Gate` section — as the **first section after the header**, before Plan Adherence — when **both** conditions are true:

1. No plan, brief, or spec exists (cold review or plan was skipped)
2. The feature being reviewed falls into a high-risk category:
   - Authentication / authorisation
   - Security-sensitive data handling (passwords, tokens, PII, secrets)
   - Compliance-adjacent logic (billing, legal, audit trail)
   - Any feature where a wrong implementation creates an irreversible user impact

### What the section contains

```
## Pre-Implementation Gate

**Status:** GATE TRIGGERED — [category] feature reviewed without a written spec

This implementation covers [auth / security / compliance] functionality. Work in this
category requires a written spec before implementation begins. No spec was found.

**Risk:** Without a spec, success criteria cannot be verified — only whether the code
is internally consistent, not whether it is correct for the intended use case.

**Recommendation:** [Approve if implementation is clearly correct and well-scoped] /
[Block until spec is produced and implementation is validated against it]

**Does this block Arbiter's verdict?** [YES — BLOCK until spec produced] / [NO — flag
only, Arbiter's verdict stands] — Compass decides based on severity of the gap.
```

### What this replaces

This replaces the current behavior where the gate observation is buried inside `## Compass's Verdict: CHALLENGE` or in strategic notes. The content may still appear in the CHALLENGE section if Compass CHALLENGEs, but the gate section is always top-level and standalone.

---

## Gap 2: Requirements Coverage — Defined vs. Undefined Criteria

### Current behavior

Compass lists requirements as `MET / NOT MET` under a single Requirements Coverage section. When criteria were never specified, she treats it as NOT MET — conflating a planning failure with an implementation failure.

### New behavior

Split Requirements Coverage into two subsections:

```
## Requirements Coverage
**Status:** [Complete / Implementation Gaps / Specification Gaps / Both]

### Defined Criteria — Implementation Check
*Criteria were specified. Checking whether implementation meets them.*
- [criterion]: MET / NOT MET — [details]

### Undefined Criteria — Specification Gap
*No success criteria were defined for these areas. This is a planning failure, not an
implementation failure. Flag for the team to address before this work is merged.*
- [area]: UNSPECIFIED — [what should have been defined and why it matters]
```

**Severity distinction:**
- `NOT MET` under Defined Criteria → implementation failure → can block Arbiter's verdict
- `UNSPECIFIED` under Specification Gap → planning failure → Compass flags, does not automatically block, but notes the risk

If no Specification Gaps exist, omit that subsection. If no Defined Criteria exist at all (pure cold review), output only the Specification Gap subsection and note it prominently.

---

## Gap 3: CHALLENGE Grounding Requirement

### Current behavior

Compass can raise a CHALLENGE item based on judgment or pattern recognition without citing the specific evidence. This is unacceptable — a CHALLENGE that cannot be traced to a specific file:line or documented gap is an opinion, not a finding.

### New rule

Every item in `### If CHALLENGE:` must include a grounding citation:

```
### If CHALLENGE:
- [item]: [why it matters, what should change]
  **Grounded in:** [file:line — specific code or gap] / [plan item X — cited section] /
  [requirement Y — defined in Discussion Summary]
```

**Grounding sources (in order of preference):**
1. `file:line` — specific code in the reviewed PR
2. Named plan item or spec section
3. Named requirement from Discussion Summary or Research Findings
4. Named output from another Forgeflow agent (cite agent + section)

**If Compass cannot ground a CHALLENGE item** — it must be dropped or demoted to a question in `## Open Questions` (a new optional section), not raised as a CHALLENGE finding.

**Anti-heuristic rule:** "This pattern is usually wrong" is not grounding. The grounding must identify the specific instance in the code under review, not a class of problem.

---

## Scope

**In scope:**
- Add `## Pre-Implementation Gate` section to `compass-review.md` output format and rules
- Update `## Requirements Coverage` output format in `compass-review.md` to split Defined vs. Undefined
- Add CHALLENGE grounding requirement to `compass-review.md` output format and rules
- Add optional `## Open Questions` section to output format (for ungrounded CHALLENGE items demoted)
- Sync live `~/.claude/agents/compass-review.md`

**Out of scope:**
- Changes to compass-discuss, compass-research, compass-plan, compass-implement, compass-present
- Changes to any other Forgeflow agent
- New scoring system or verdict scale changes
- Changes to Atlas's behavior (separate spec)

---

## Insertion Points

### compass-review.md — Output Format

**Gap 1:** Insert `## Pre-Implementation Gate` block in the output template between the header line and `## Plan Adherence`. Mark it as conditional: `[Include when: no spec exists AND feature is auth/security/compliance/compliance-adjacent]`.

**Gap 2:** Replace the existing `## Requirements Coverage` block with the two-subsection version (Defined Criteria + Specification Gap).

**Gap 3:** Replace the existing `### If CHALLENGE:` block with the grounded version. Add `## Open Questions` as an optional final section before the CHALLENGE block.

### compass-review.md — Rules

**Gap 1:** Add rule: "When reviewing cold (no plan/spec) AND the feature is auth, security, token/PII handling, or compliance-adjacent, output `## Pre-Implementation Gate` as the first section. This is not optional. Bury nothing."

**Gap 2:** Add rule: "In Requirements Coverage, never conflate a missing spec with a failing implementation. `UNSPECIFIED` is a planning failure. `NOT MET` is an implementation failure. They carry different weight and different remediation paths."

**Gap 3:** Add rule: "Every CHALLENGE item must cite its grounding: file:line, plan item, requirement, or named agent output. An ungrounded CHALLENGE item is an opinion. Drop it or demote it to `## Open Questions`."

---

## Success Criteria

- `compass-review.md` output format includes `## Pre-Implementation Gate` as first conditional section
- `compass-review.md` output format splits Requirements Coverage into Defined / Undefined subsections
- `compass-review.md` output format includes grounding citation on each CHALLENGE item
- `compass-review.md` rules section includes all three enforcement rules
- `compass-review.md` output format includes `## Open Questions` as optional section
- Live `~/.claude/agents/compass-review.md` matches repo agent exactly
- No changes made to any other agent file
