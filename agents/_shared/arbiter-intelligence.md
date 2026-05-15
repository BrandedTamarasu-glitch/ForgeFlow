---
name: arbiter-intelligence
description: Canonical Arbiter Intelligence reference. Not an agent — a shared reference file. Update here, then copy relevant sections into arbiter-{consult,implement,review}.md.
---

## Conflict Resolution Hierarchy

When two findings conflict or compete for priority, higher-tier findings take precedence. The hierarchy is a tiebreaker and escalation guide, not a filter — a Craft finding that is also a Security concern escalates to Tier 1.

| Tier | Label | Rule |
|------|-------|------|
| 1 | Security | Warden Tier 1 (OWASP Core) or Tier 2 (authenticated surface) finding per `_shared/warden-security-intelligence.md`. Always wins against any lower tier. |
| 2 | Confirmed Defect | A defect inferable from static analysis of visible code is confirmed; when this conflicts with lower tiers, the defect report wins. Confirmation does not require a stack trace. |
| 3 | Spec Alignment | Does the implementation conform to the stated spec or feature request? When this conflicts with Tier 4 or 5, spec conformance wins. |
| 4 | User-Visible Impact | Does this affect a user-observable behavior? When this conflicts with Tier 5, user impact wins. |
| 5 | Craft | Code quality, elegance, naming — lowest priority. Loses to all higher tiers when in direct conflict. |

**Tiebreak rule (same tier):** The finding more specifically grounded in the visible code takes precedence over one applying a general heuristic.

## Blocked Findings Protocol

A finding is **Blocked** when it cannot be confirmed by the agent who raised it from files explicitly in their current context. Three gates determine whether a finding qualifies:

**Gate 1 — Specificity bar:** "Context needed" must name the exact file + exact symbol/behavior + impact if confirmed. Vague requests such as "need to see runtime behavior" are rejected and the finding must be resolved from visible code or dropped.

**Gate 2 — Numeric cap:** Maximum 3 blocked findings per pass. More than 3 blocked findings indicates insufficient code surface was provided — force triage and discard the weakest until at or below the cap.

**Gate 3 — Positive indicator required:** The agent must have an affirmative reason to believe this is a real finding. Absence of counter-evidence is not a positive indicator; if the only basis is "I cannot rule it out," the finding is not a candidate for blocking.

**Definition of "unresolvable":** Cannot be confirmed by the agent who raised it from files explicitly in their current context. A finding confirmed by another agent with a `file:line` reference is confirmed — Arbiter's independent inability to re-verify it does not make it blocked.

**Interim actions (valid only):**

- **BLOCK** — Treat as a blocker until the finding is resolved.
- **CONDITIONAL APPROVE** — Approve if all other findings are resolved; this finding remains open.
- **IGNORE** — Severity is too low to change the verdict; finding is noted and closed.

No other interim actions are valid.

**Mode-behavior table:**

| Mode | Trigger | Action | Output location |
|------|---------|--------|-----------------|
| Consult | Agent brief contains a finding requiring unwritten or unseen code to confirm | Route to brief's Blocked section | `## Blocked Findings — Awaiting Context` in Implementation Brief |
| Implement | Deviation caused by an unconfirmable condition | Escalate via Path 3 deviation protocol | Deviation log + Amendment Log if brief updated |
| Review | Review finding cannot be confirmed from visible code | Withhold from main findings | `## Blocked Findings — Awaiting Context` in Consolidated Review |

## Verdict Scale

<!-- each cell in "Cannot use when": single clause or noun phrase only -->

| Verdict | Condition | Cannot use when |
|---------|-----------|-----------------|
| APPROVE | All confirmed findings are resolved | Any open confirmed defect exists |
| CONDITIONAL APPROVE | No confirmed blockers; one or more blocked findings remain open and unresolvable | Confirmed defect exists |
| REVISE | Confirmed issues exist and are fixable | — |
| BLOCK | Confirmed critical or security defect | Finding is unconfirmed |

## Deviation Protocol

1. **Path 1 — Agent deviation, brief unchanged:** Agent deviates from the brief on their own judgment; Arbiter approves or redirects with rationale. The brief is not updated; the deviation is logged under `## Deviations Approved`.

2. **Path 2 — Agent requests brief change:** Arbiter evaluates the request and, if approved, updates the brief in-place before any dependent agent proceeds. The deviation is logged under `## Deviations Approved` with the note "brief updated."

3. **Path 3 — Deviation reveals brief flaw:** The brief is amended in-place (never versioned to a new file). A `## Amendment Log` entry is appended with the fields: date | triggering wave | what changed | downstream waves affected. Agents not yet mid-execution read the amended brief automatically; agents mid-execution must re-read the brief before finalizing output. The orchestrator or human determines whether completed waves need re-execution — Arbiter does not decide unilaterally.

## Scope Gate

Applied as step 1.5 in the consult process, between "Read all agent briefs" and "Resolve conflicts." All three checks are mandatory.

1. **New work check:** Does any agent brief propose work not present in the feature request or prior brief? If yes, name it explicitly and require justification before including it in scope.

2. **Boundary check:** Does any proposed change affect components outside the stated scope boundary? If yes, explicit Arbiter approval is required before the brief can include it.

3. **Scope growth check:** Has total scope grown since the last brief? If yes, log the delta in `## Rejected Alternatives` or promote it to a separate brief — do not silently absorb scope expansion.

## Rejected Alternatives Log

Per-brief output section. No prose in cells — concise phrases only.

| Alternative | Proposed by | Reason rejected |
|-------------|-------------|-----------------|
| [example row — remove before use] | [agent] | [one-line reason] |

## Lead Architect Intelligence

Three named protocols. Arbiter applies the subset relevant to the active mode.

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
