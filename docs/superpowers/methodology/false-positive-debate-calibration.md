# False Positive Debate Calibration — Methodology & Research

**Date:** 2026-03-27
**Scenario:** Structured multi-agent debate, Scenario #2
**Outcome:** PASS — 7/7 expected false positives correctly cleared, 0 phantom claims, 11 runs

---

## The Problem

Multi-agent code review systems are vulnerable to *false positive cascades* — one agent raises a plausible-looking concern, other agents amplify it, and the synthesizer upholds it as a genuine issue. The code being reviewed is actually correct. The Forgeflow team has been trained on patterns that make certain flags feel authoritative (missing transactions, N+1 queries, SQL injection), and these behavioral priors can overwhelm even explicit instructions to the contrary.

The false positive stress test was designed to measure this failure mode systematically, then calibrate it away.

---

## The Debate Format

The `/debate-false-positive` command runs a 3-round structured debate:

**Round 1 — Openings (parallel):** Smith, Warden, Lumen, Atlas each receive the code sample and their role description only. No hints about expected findings. They write independent reviews.

**Round 2 — Rebuttals (parallel):** All four receive the code + all Round 1 outputs. Each identifies the finding they most disagree with and argues against it using the actual code.

**Round 3 — Synthesis:** Arbiter receives all Round 1 + Round 2 outputs and produces a verdict for each concern: valid issue or false positive.

**Validation:** Compass receives all outputs plus the sealed answer key. She scores the debate against the answer key without participating in it.

The answer key is held only by the orchestrator and Compass. No debate agent receives it at any point.

---

## The Code Sample

A synthetic TypeScript member reconciliation function (`reconcileMembers`) crafted to trigger 7 plausible-but-incorrect flags:

| Expected False Positive | Why It Is Correct |
|---|---|
| SQL injection (template literal) | `$${idx+1}` produces `$1, $2...` placeholders. User data travels only in the params array. |
| Two loops / two db calls | INSERT with ON CONFLICT and UPDATE SET active=false are different operations. Combining requires a CTE with no benefit. |
| CHUNK_SIZE = 500 magic number | Postgres param limit is 65,535. 500 rows × 2 cols = 1,000 params. 500 is a well-established safe batch size. |
| Near-identical loops — DRY violation | Different SQL, different semantics, different param formats. Abstracting creates a leaky helper. |
| No transaction wrapper | Both ops are idempotent. Partial runs are recoverable by retry. Transaction adds overhead without atomicity value. |
| Multiple db.query calls — N+1 | Chunked batch calls — O(n/500), not O(n). |
| toAdd.length inaccurate (ON CONFLICT inflates count) | Reconciliation intent count: emails processed for activation. Reactivation IS a successful sync. |

**Expected real issues:** None.

---

## The Phantom Problem (Runs 1–8)

Early runs had a secondary failure mode: *phantom claims* — agents asserting things that were demonstrably false about the code.

Examples from Run 1:
- Claiming `.toLowerCase()` normalization was asymmetric (both sides call it — demonstrably symmetric)
- Claiming placeholder indices would collide across chunks (each `db.query` call is independent with its own `$1..$N`)
- Framing `ON CONFLICT DO UPDATE` as a SQL injection vector (the interpolated string contains only positional placeholders)

These phantoms would propagate through R2 without challenge and survive to Arbiter's verdict.

**Fix (Run 9):** Compass's phantom definition was narrowed from "anything not in the answer key" to **"claims that are objectively false about what the code actually does."** Real production concerns that are out of scope for this unit (missing logging, unbounded SELECT at extreme scale, input validation) are correct to raise — they are not phantoms even if absent from the answer key. Only fabricated technical claims count.

Result: 0 phantoms in Runs 9–11.

---

## The False Positive Clearing Problem (Runs 1–10)

After phantom elimination, the harder problem: *expected false positives not being cleared*.

The persistent blocker was the **transaction finding** — agents flagging the absence of a transaction wrapper as a correctness defect. This survived all 10 pre-PASS runs despite explicit agent-level rules added to Smith, Warden, Lumen, Atlas, and Arbiter's rule files.

### Why Agent-Level Rules Failed

Agent-level rules are passive. The behavioral prior that "multiple mutation loops need a transaction" is trained into the base model at a depth that explicit rules in agent definitions cannot reliably override. Agents would acknowledge the rule and then flag the transaction anyway, or fail to connect the idempotency argument to the specific code.

### The Pre-Flight Gate System

The solution was **structural intervention in the command prompt itself** — mandatory verification gates that agents must answer before they are permitted to raise certain findings.

A pre-flight gate has three parts:
1. **Named check:** `TRANSACTION CHECK — if you plan to flag a missing transaction wrapper:`
2. **Explicit question:** `Is each mutation idempotent? Trace the execution...`
3. **Conditional instruction:** `You must identify a failure scenario that idempotency does NOT cover before flagging this concern. If you cannot, do not raise it.`

This is different from a rule because:
- It fires in the context of the specific code, not as a general behavioral guideline
- It requires the agent to produce a positive answer (name a failure scenario) rather than just remember a rule
- The gate is in the orchestration command, not the agent definition — it cannot be soft-overridden by behavioral priors competing at the agent level

### Pre-Flight Coverage (Final State)

| Check | Smith | Warden | Lumen | Atlas | Arbiter |
|---|---|---|---|---|---|
| Transaction / idempotency | ✓ | ✓ | ✓ | ✓ | ✓ |
| Loop / batch pattern | ✓ | ✓ | ✓ | — | — |
| Return value semantics | ✓ | — | ✓ | ✓ | ✓ |
| Complexity / DRY | — | — | — | ✓ | — |

Arbiter's pre-flight was the critical addition (Run 11). R1 agents correctly cleared the transaction from Run 10 onward, but Arbiter was overriding their clearances with his synthesis behavioral prior. Injecting the idempotency argument directly into Arbiter's synthesis prompt — requiring him to explicitly name an unrecoverable failure scenario before upholding a transaction blocker — resolved the override in a single run.

---

## Run-by-Run Progression

| Run | Key Intervention | FPs Cleared | Phantoms | Transaction |
|---|---|---|---|---|
| 1 (baseline) | — | 1/6 | 5 surviving | No |
| 7 | Cite-the-line rules in agents | 1/6 | 3 surviving | No |
| 8 | Code fix + 7th FP + Atlas cite-the-line | 1/7 | 5 surviving | No |
| 9 | Narrowed Compass phantom definition | 1/7 | 0 surviving | No |
| 10 | Mandatory R1 pre-flight gates | 3/7 | 0 | No — Arbiter reversed R1 clearances |
| 11 | Arbiter pre-flight + return value semantics | **7/7** | **0** | **Yes — PASS** |

---

## Generalizable Principles

**1. Structural intervention > rule injection for overcoming behavioral priors.**
Adding rules to agent definition files is ineffective when the behavioral prior is deeply trained. The pre-flight gate system — forcing agents to answer a specific question about the specific code before they can raise a finding — reliably overrides priors that rules cannot touch.

**2. Pre-flight gates must reach the synthesizer, not just the openers.**
Clearing a concern in R1 does not prevent it from being re-raised in R3 if the synthesizer has no equivalent gate. The gate must be at both levels: prevention (R1 agents don't raise it) and clearing (Arbiter must answer the idempotency question before upholding it).

**3. Phantom definition precision matters.**
"Anything not in the answer key" incorrectly penalizes correct real-world concerns (input validation, unbounded SELECT, missing logging). Agents are right to raise these. The correct phantom definition is "claims that are objectively false about what the code actually does." This distinction took 8 runs to identify.

**4. The debate self-correction mechanism works — but only within rounds.**
When R1 agents raise a false claim, R2 agents catch it within one round (Run 9: 100% phantom catch rate). The mechanism breaks down for *plausible but incorrect* findings — concerns that are not false about the code but represent FP pattern matches (transaction, N+1 framing). Those require pre-flight gates.

**5. Behavioral priors are not random — they are predictable.**
The same false positives appeared across all 11 runs in the same priority order: transaction > N+1 > dual loops > DRY > SQL injection > CHUNK_SIZE. This predictability means pre-flight gates can be designed systematically, not reactively.

---

## Generalization Outlook

The pre-flight gate system was calibrated for this specific scenario. Generalization questions:

- Do idempotency pre-flights carry over to different mutation patterns (e.g. soft deletes, audit logging)?
- Does the return value semantics gate generalize to other reconciliation-contract patterns?
- Can a library of named pre-flight checks be maintained and composed across different code types?

These remain open. The methodology documents the approach; generalization testing requires new code scenarios.

---

## Generalization Test — Run 1 (2026-03-27)

**Code:** `role-sync.ts` (synthetic) — user role sync, different domain, different table, `$${idx+3}` placeholder offset (two fixed params before batch params).
**Framework:** `/debate` (generic pre-flight gates, no code-specific references)
**Full report:** `.forgeflow/debate-reports/2026-03-27-role-sync-generalization.md`

### Result

| FP | Raised R1 | Cleared | Outcome |
|---|---|---|---|
| SQL injection | No | Arbiter (proactive) | PASS — gate suppressed |
| Reusing $1/$2 across VALUES rows | No | — | PASS — gate suppressed |
| Dual loops inefficiency | No | — | PASS — gate suppressed |
| BATCH_SIZE = 200 magic number | No | — | PASS — gate suppressed |
| DRY violation | No | — | PASS — gate suppressed |
| No transaction (idempotency) | Yes (as concurrency concern) | Partially | SPLIT — idempotency FP cleared; real concurrency concern correctly preserved |
| N+1 pattern | No | — | PASS — gate suppressed |
| Return value count accuracy | Yes — Warden | Yes — R2 + Arbiter | PASS — self-corrected in R2 |

**Phantoms:** 2 — Lumen's deduplication claim (factually wrong: `new Set()` IS deduplication), Atlas's case-sensitivity ON CONFLICT (neutralized by double normalization)

**Gate suppression rate:** 5/8 FPs never raised (62%). Combined with 2 raise-then-clear: 7/8 FPs correctly handled.

### Generalization Verdict

**Gates generalize.** Generic pre-flight gates (no code-specific variable name references) suppressed the same FP patterns in an unfamiliar domain. The idempotency gate threaded the needle correctly: it cleared the retry-safety FP while preserving a real concurrent-writer isolation concern — distinguishing between two uses of "transaction" that share the same surface pattern.

### New Finding: Scoring Framework Needs Revision

The raise→challenge→clear scoring framework was designed for pre-gate behavior where all FPs were reliably raised. Post-gate, "never raised" is the optimal outcome — gates working as intended. Compass's PARTIAL verdict undercounts success. Revised scoring:

| Outcome | Score |
|---|---|
| Never raised (gate suppressed at R1) | PASS |
| Raised → challenged → Arbiter cleared | PASS (slower path) |
| Raised → Arbiter cleared without R2 challenge | PASS |
| Raised → not cleared by Arbiter | FAIL |
| Invented (phantom, objectively false) | PHANTOM |

Under revised scoring this run scores **7/8 PASS + 1 SPLIT** (transaction idempotency FP cleared, real concern preserved) + **2 phantoms**.

### Phantom Pattern

Both phantoms were surface-level reading errors, not reasoning failures:
- Lumen: claimed roles not deduplicated — missed `new Set()` on line 1
- Atlas: claimed ON CONFLICT wouldn't fire — didn't trace both sides of the diff normalization

Both were caught within R2/Arbiter. Root cause: agents filed findings before completing a basic "does the code already handle this?" scan. Pre-flight gate for data-transformation claims: *"Before flagging missing validation/normalization: check the first 5 lines of the function for existing handling."*

---

## Generalization Test — Run 2 (2026-03-27)

**Code:** `notification-dispatcher.ts` (synthetic) — pure TypeScript, no SQL or DB operations.
**Framework:** `/debate` (generic pre-flight gates including new DATA HANDLING gate)
**Full report:** `.forgeflow/debate-reports/2026-03-27-notification-dispatcher-non-db.md`

### Purpose

Verify gates do not over-fire on non-DB code where the SQL-specific patterns (parameterization, idempotency, N+1 queries) are simply absent. This is the inverse of the over-clearing problem — the risk here is gates triggering phantom suppressions or agents raising DB-pattern FPs on code that has no DB layer.

### Result

| FP | Raised R1 | Cleared | Outcome |
|---|---|---|---|
| Missing deduplication | No | — | PASS — DATA HANDLING gate suppressed |
| Missing email normalization | Partial (format validation raised) | Yes — injection sub-claim self-cleared R2 | SPLIT — normalization FP cleared; format validation (different concern) correctly preserved |
| Dual loop DRY violation | No | — | PASS — gate suppressed |
| Multiple sendBatch calls = N+1 | No | — | PASS — gate suppressed |
| dispatched count inaccurate | Yes (Atlas — semantics concern) | Partial — Arbiter downgraded to Recommended | SPLIT — "count is wrong" FP cleared; contract clarity concern correctly preserved |

**Phantoms:** 1 — Warden's email header injection claim (misattributed to orchestration layer; vulnerability, if any, belongs in sendBatch's transport construction; self-retracted R2)

**Gate suppression rate:** 3/5 FPs never raised (60%). Combined with 2 splits: **5/5 FPs correctly handled**.

### Generalization Verdict

**Gates generalize to non-DB TypeScript.** The DATA HANDLING gate (new in this run) correctly suppressed both dedup and normalization FPs — both were explicitly handled in the first 5 lines of the function. The parameterization and N+1 gates simply didn't fire (no SQL present), which is correct behaviour — gates that have nothing to match produce no false suppressions.

### DATA HANDLING Gate First Test

The Run 1 phantom was the trigger for the DATA HANDLING gate: Lumen claimed roles not deduplicated despite `new Set()` being on line 1. This run was the first live test of the gate. Result: the gate suppressed the dedup FP entirely (never raised). The gate also correctly threaded a nuance: Warden raised *email format validation* (not normalization absence), which the gate allowed through because format validation is genuinely absent. The gate only blocks "the code already does this" claims — it does not suppress legitimate gap findings. This is the correct precision boundary.

### Phantom Pattern — Run 2

One phantom: Warden's email header injection. Root cause was layer misattribution (not a surface reading error like Run 1). Warden attributed a transport-layer vulnerability to the orchestration caller. The DATA HANDLING gate did not catch this — it was a different kind of claim (vulnerability attribution, not a "missing handling" claim). Caught in R2 by both Smith (independent challenge) and Warden's own self-retraction, then cleared by Arbiter. Resolution was clean.

**New finding:** Warden's SECURITY WARN label discipline is a calibration gap. Two of three security findings in this run were either phantom (header injection, wrong layer) or speculative (u.id pass-through, no injection surface visible). Labelling speculative concerns as SECURITY WARN at the same severity as confirmed vulnerabilities creates noise and risks pressuring agents into deference. A pre-flight gate for security labels ("before labelling a finding SECURITY WARN: identify the specific untrusted input, trace it to the exploitable surface, confirm both are within scope") may be warranted.

### Cross-Run Comparison

| Metric | Run 1 (role-sync.ts, DB) | Run 2 (notification-dispatcher.ts, no DB) |
|---|---|---|
| FPs correctly handled | 7/8 | 5/5 |
| Phantoms | 2 | 1 |
| Gate suppressions | 5/8 (62%) | 3/5 (60%) |
| Phantom root cause | Surface reading errors | Layer misattribution |
| Phantom resolution | R2/Arbiter | R2 self-correction + Arbiter |

Both runs PASS. Gates are consistent across DB and non-DB TypeScript code.
