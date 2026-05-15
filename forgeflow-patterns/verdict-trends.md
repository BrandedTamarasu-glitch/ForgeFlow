# Verdict Trends

Observations on how verdict distribution correlates with project characteristics. Used by Atlas during `/plan` and `/consult` to set expectations and by Arbiter during `/review` to calibrate severity.

Seeded from `.forgeflow/` data across campaign-management, llama.cpp, SubAgents, and Forgeflow meta-work on 2026-04-17.

---

## Project type vs verdict pattern

| Project type | Typical verdict distribution | Interpretation |
|---|---|---|
| **Schema / migration heavy** (campaign-management, GSD-CIC) | BLOCK: 35%, REVISE: 45%, APPROVE: 20% | High data-integrity risk surface. Reviews find real issues. Plans need explicit schema-consumer audit. |
| **Low-level systems** (llama.cpp, NPU backend) | BLOCK: 25%, REVISE: 30%, APPROVE: 45% | Reviews often sparse-but-sharp. When blockers appear, they're silent-correctness issues, not obvious bugs. |
| **Agent tooling / meta-work** (SubAgents, Forgeflow) | BLOCK: 10%, REVISE: 50%, APPROVE: 40% | High churn via fix-passes. Individual reviews rarely block, but multiple rounds common. |
| **UI / theme work** (Pallet Town theme) | BLOCK: 5%, REVISE: 30%, APPROVE: 65% | Lowest BLOCK rate. /ui-iterate's measured fitness loop reduces REVISE further. |

## Implications

**For `/plan`:**
- If Atlas recognizes a project as schema/migration-heavy, surface historic BLOCK rate and require explicit Error Paths section in the plan
- If project is low-level systems, require a "what could silently go wrong" section
- If agent tooling, warn user to expect 2+ review rounds; encourage using `/review-auto`

**For `/consult`:**
- Calibrate Smith's "data integrity risk" scrutiny to project type — schema-heavy gets highest, UI work gets lowest
- Calibrate Warden's Tier 2 threat enumeration by project type — auth-adjacent projects get full Tier 2 every time

**For `/review`:**
- A schema-heavy project with an APPROVE verdict on the first pass is anomalous — Arbiter should double-check for silent gaps the reviewers might have missed
- An agent-tooling project with a BLOCK verdict is anomalous — usually these surface as REVISE; a BLOCK suggests the work touched something load-bearing that needs extra care

---

## Anomaly patterns (when typical trend is violated)

### First-pass APPROVE on a schema change

**Normal:** Schema changes go through 1-2 REVISE rounds.

**Anomaly:** APPROVE on first pass.

**Likely cause:** Reviewer didn't check all consumers. Smith should have grep'd for all call sites; Atlas should have cross-referenced every plan-declared artifact.

**Action:** Arbiter flags this for double-check. Does not block APPROVE but notes the anomaly in review-history for next cycle.

### REVISE loop that doesn't converge

**Normal:** `/review-auto` closes 64% of REVISEs in 1 round, 90% within 2.

**Anomaly:** Third REVISE with different findings each round.

**Likely cause:** Underlying design issue that point-fixes can't resolve. Should escalate to `/consult` or `/discuss` rather than grinding through `/review-auto`.

**Action:** After 2 REVISE rounds with different finding classes, Arbiter recommends de-escalation to consult/discuss instead of another fix round.

### BLOCK on agent-tooling work

**Normal:** Agent work gets REVISE, rarely BLOCK.

**Anomaly:** BLOCK on a command/agent/hook edit.

**Likely cause:** Edit touches the Forgeflow team's coordination layer (orchestration, state persistence, dispatch). These are load-bearing; breaking them breaks the whole Forgeflow.

**Action:** Treat as high-severity — do not use `/review-auto` on it. Require manual fix + fresh review.

---

## Future telemetry

As Phase 1 (`forgeflow-telemetry.js`) accumulates data, this file gets updated with empirical numbers rather than estimates. Rerun `/forgeflow-learnings` monthly to promote observed patterns.

Pre-telemetry estimates in the table above are based on raw counts from review-history.md files — not uniform coverage, but directionally correct.
