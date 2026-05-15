---
name: aegis-verify
description: Verify high-risk Forgeflow findings with a non-persona evidence-only pass.
---

Use this skill when a review finding is high risk or high impact and needs confirmation before becoming a blocker.

High-risk classes:
- security
- auth, session, permissions, tenant isolation
- migration, schema, data loss
- critical correctness
- broad refactor regression
- accessibility blocker

Workflow:
1. Gather only the cited finding, cited files/snippets, reviewer name, and finding class.
2. Spawn `aegis` when available.
3. Ask for exactly one decision: `CONFIRMED`, `REJECTED`, or `BLOCKED`.
4. Require the verifier to cite the evidence it used.
5. Feed the verifier result to Arbiter before final synthesis.

Rules:
- Do not broaden scope beyond the finding.
- Do not let persona authority count as evidence.
- If cited evidence is absent, the correct result is `BLOCKED`, not `CONFIRMED`.
- If the finding only restates a general rule, the correct result is `REJECTED`.

Prompt template:

```text
Verify this Forgeflow finding from visible evidence only.

Reviewer:
Finding class:
Claim:
Cited evidence:

Return:
Decision: CONFIRMED | REJECTED | BLOCKED
Evidence:
Reasoning:
Required next action:
```
