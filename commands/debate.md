---
name: debate
description: Run a structured multi-agent false-positive stress test against a code sample and sealed answer key
argument-hint: "<CODE and ANSWER KEY sections>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Agent
---
# /debate — Code Review False Positive Stress Test

A 3-round structured debate to stress-test the Forgeflow against any code sample with a known answer key.

## Usage

Run `/debate` and provide code + answer key in the following format:

```
CODE:
[paste code here]

ANSWER KEY:
FP: [concern label] — [why it is correct as written]
FP: [concern label] — [why it is correct as written]
...
REAL: None  (or list any genuine issues expected)
```

---

## ⚠️ ORCHESTRATOR RULES

- Parse the user's input: extract the CODE section and the ANSWER KEY section
- The ANSWER KEY is for your eyes only — never quote it, paraphrase it, or include any of its content in agent prompts
- Every agent prompt contains: code sample + role description + pre-flight gates only — nothing from the answer key
- Compass is the only agent who receives the answer key, in the final validation step
- `[CODE]` in the prompt blocks below means: substitute the full code from the CODE section
- `[ROUND_N_OUTPUTS]` means: substitute the collected outputs from that round

---

## Round 1 — Openings (run all four in parallel)

Spawn Smith, Warden, Lumen, and Atlas simultaneously. Each receives only the code and its role.

---

**Smith prompt:**
```
Review the following code for quality, design, structure, naming, and correctness.
State your findings clearly. Be specific — include the exact concern and the line or
pattern it refers to.

Before stating any finding, complete these mandatory pre-flights:

TRANSACTION PRE-FLIGHT — if you plan to flag a missing transaction wrapper:
Trace each mutation in the function. For each INSERT, UPDATE, or DELETE: if the
function is called again with identical inputs after a partial failure, does each
mutation produce the same final database row state? A mutation is idempotent if:
- It sets a column to a fixed value (SET is_active = false, SET status = 'done')
- It upserts via INSERT ... ON CONFLICT DO UPDATE to a deterministic state
If ALL mutations are idempotent, partial failure is recoverable by retrying — no
transaction needed. State explicitly: what specific data inconsistency can occur
that idempotency does NOT prevent? If you cannot identify one, do not flag missing
transaction as a blocker.

LOOP/QUERY PATTERN PRE-FLIGHT — if you plan to flag inefficient looping or excessive
db calls: Determine whether calls are per-item or per-batch. If a loop slices input
into fixed-size batches and issues one call per batch, the pattern is O(n/batch_size),
not O(n). That is not N+1. Only flag N+1 if calls are genuinely one per individual
record. If two loops perform different SQL operations (INSERT vs UPDATE), verify
whether they can actually be merged without a CTE or semantic change — if not, the
separation is intentional.

PARAMETERIZATION PRE-FLIGHT — if you plan to flag SQL injection on a template literal:
Trace every expression interpolated into the SQL string. If all interpolated values
are parameter placeholder tokens ($1, $2, $N) or integer-arithmetic expressions that
produce placeholder tokens (e.g., `$${idx + 1}`), no user-supplied data enters the
SQL string — the query is correctly parameterized. Only flag injection if you can
trace a path from user-controlled input directly into the SQL string itself (not the
params array).

RETURN VALUE PRE-FLIGHT — if you plan to flag that a return value misrepresents outcomes:
Determine what the function's return type documents. If it documents operation intent
counts (records processed for a state change, items reconciled) rather than net-new DB
row counts, re-applications or re-activations are correct per that contract. Only flag
if the return type explicitly promises something the implementation does not deliver.

SEMANTIC SEPARATION PRE-FLIGHT — if you plan to flag near-identical code blocks as a
DRY violation: Verify that both blocks perform the same SQL operation with the same
semantics. If they use different SQL (INSERT vs UPDATE), different target states, or
different WHERE clauses, they represent intentional separation of concerns — not a DRY
violation. Abstracting them requires conditional parameters or branching logic that
obscures intent. Only flag DRY if code AND semantics are genuinely identical.

DATA HANDLING PRE-FLIGHT — if you plan to flag missing validation, normalization, or
deduplication: Before raising this finding, check the first 5 lines of the function
for existing handling of the specific data concern. If the function already validates,
normalizes, or deduplicates the relevant input before it reaches the code you are
reviewing, do not raise the absence as a finding. Only flag if the handling is
genuinely absent for data that reaches the logic in question.

[CODE]
```

---

**Warden prompt:**
```
Review the following code for security vulnerabilities, efficiency concerns, and
correctness. State your findings clearly. Be specific — include the exact concern
and the line or pattern it refers to.

Before stating any finding, complete these mandatory pre-flights:

TRANSACTION PRE-FLIGHT — if you plan to flag a missing transaction wrapper:
Trace each mutation. For each: if the function retries after partial failure, does
the mutation produce the same final row state? Idempotent mutations (fixed-value SET,
INSERT ... ON CONFLICT DO UPDATE) self-heal on retry. State explicitly: what failure
mode exists that idempotency does not recover from? If you cannot identify one,
downgrade the transaction concern to a recommendation — not a blocker.

N+1 PRE-FLIGHT — if you plan to flag N+1 or excessive db calls:
Count the actual call frequency. If a loop batches rows (one call per N-row chunk),
the pattern is O(n/batch_size). N+1 is one call per individual record with no
batching. State the exact O() complexity before deciding whether to flag it.

INJECTION PRE-FLIGHT — if you plan to flag SQL injection on a template literal:
Trace every interpolated value back to its origin in the code. If all interpolated
expressions are parameter placeholder tokens ($1, $N) or integer-arithmetic
expressions of array indices that produce those tokens, no user data reaches the
SQL string. Parameterization is correct. Only flag injection if user-controlled
input reaches the SQL string directly (not via the params/bind array).

DATA HANDLING PRE-FLIGHT — if you plan to flag missing validation, normalization, or
deduplication: Before raising this finding, check the first 5 lines of the function
for existing handling of the specific data concern. If the function already validates,
normalizes, or deduplicates the relevant input before it reaches the code you are
reviewing, do not raise the absence as a finding. Only flag if the handling is
genuinely absent for data that reaches the logic in question.

[CODE]
```

---

**Lumen prompt:**
```
Review the following code for connectivity patterns, data pathway efficiency, and
service integration health. State your findings clearly. Be specific.

Before stating any finding, complete these mandatory pre-flights:

TRANSACTION PRE-FLIGHT — if you plan to flag missing transaction wrapper:
Determine idempotency for each mutation: if re-run after partial failure, does it
reach the same database state? If yes for all mutations, partial failure is
recoverable by retry. State what specific consistency guarantee a transaction
provides here that retry does not. If you cannot, do not flag it.

BATCH PATTERN PRE-FLIGHT — if you plan to flag multiple db calls as inefficient:
Verify call frequency. Per-batch calls are O(n/batch_size), not O(n). Separate
loops for INSERT and UPDATE operations cannot be combined without restructuring SQL —
the separation is intentional. Only flag if you can propose a concrete, simpler
alternative that reduces actual call count.

PARAMETERIZATION PRE-FLIGHT — if you plan to flag template literal SQL as an
injection risk: Trace interpolated values. If all are parameter placeholder tokens
or index-arithmetic expressions that produce placeholder tokens, the query is
parameterized. No user data in the SQL string = no injection risk.

RETURN VALUE PRE-FLIGHT — if you plan to flag return value inaccuracy:
Determine the documented return contract. If it promises intent counts (operations
processed) rather than net-new rows, re-activations count as operations processed.
Only flag if the implementation contradicts the documented contract.

DATA HANDLING PRE-FLIGHT — if you plan to flag missing validation, normalization, or
deduplication: Before raising this finding, check the first 5 lines of the function
for existing handling of the specific data concern. If the function already validates,
normalizes, or deduplicates the relevant input before it reaches the code you are
reviewing, do not raise the absence as a finding. Only flag if the handling is
genuinely absent for data that reaches the logic in question.

[CODE]
```

---

**Atlas prompt:**
```
Review the following code from a program management perspective. Is the approach
sound? Are there hidden complexity risks, coordination concerns, or scope issues?
State your findings clearly.

Before stating any finding, complete these mandatory pre-flights:

TRANSACTION PRE-FLIGHT — if you plan to flag missing transaction wrapper as a risk:
Determine if each mutation is idempotent — can the function safely retry after
partial failure and reach a consistent state? If yes, the transaction concern
disappears. State a concrete scenario where idempotency fails before raising this.

COMPLEXITY PRE-FLIGHT — if you plan to flag a dual-loop structure as unnecessary
complexity: Verify whether the two loops perform the same SQL operation. If they
use different SQL with different semantics (INSERT vs UPDATE), separation is
intentional. A combined CTE would increase cognitive overhead without reducing
call count. Only flag if you can propose a simpler equivalent.

RETURN VALUE PRE-FLIGHT — if you plan to flag return value accuracy:
Determine the function's documented return contract. Intent counts and net-new
row counts are different contracts. Only flag if the implementation contradicts
what is documented.

DATA HANDLING PRE-FLIGHT — if you plan to flag missing validation, normalization, or
deduplication: Before raising this finding, check the first 5 lines of the function
for existing handling of the specific data concern. If the function already validates,
normalizes, or deduplicates the relevant input before it reaches the code you are
reviewing, do not raise the absence as a finding. Only flag if the handling is
genuinely absent for data that reaches the logic in question.

[CODE]
```

Collect all four Round 1 outputs before proceeding to Round 2.

---

## Round 2 — Rebuttals (run all four in parallel)

Each agent receives the code AND all Round 1 outputs. Instruction: identify the
finding you most disagree with and explain why it is incorrect or overstated.

---

**Smith prompt:**
```
You are reviewing code. Below are findings from four reviewers (Round 1). Read all
of them carefully, then identify the finding you most disagree with and explain why
it is incorrect or overstated. Be specific — show your reasoning against the actual code.

Code:
[CODE]

Round 1 findings:
[ROUND_1_OUTPUTS]
```

---

**Warden prompt:**
```
You are reviewing code through a security and efficiency lens. Below are findings
from four reviewers (Round 1). Read all of them carefully, then identify the security
or efficiency finding you most disagree with and explain why it is incorrect or
overstated. Trace the data flow or execution path that supports your position.

Code:
[CODE]

Round 1 findings:
[ROUND_1_OUTPUTS]
```

---

**Lumen prompt:**
```
You are reviewing code through a connectivity and data pathway lens. Below are
findings from four reviewers (Round 1). Read all of them carefully, then identify
the connectivity or efficiency finding you most disagree with and explain why it
is incorrect or overstated. Trace the call chain or batch pattern that supports
your position.

Code:
[CODE]

Round 1 findings:
[ROUND_1_OUTPUTS]
```

---

**Atlas prompt:**
```
Below are findings from four reviewers (Round 1) on a code sample. Read all findings
carefully. Challenge any that appear disproportionate to actual risk or that conflate
pattern preference with correctness. Cite the specific code evidence that supports
your challenge.

Code:
[CODE]

Round 1 findings:
[ROUND_1_OUTPUTS]
```

Collect all four Round 2 outputs before proceeding to Round 3.

---

## Round 3 — Arbiter's Synthesis

Spawn arbiter-review with the code and all Round 1 + Round 2 outputs.

---

**Arbiter prompt:**
```
You have received a code sample and two rounds of agent review (openings and
rebuttals). Synthesize all findings. For each concern raised, determine whether
it is a valid issue or a false positive. Be explicit — name the concern, give your
verdict, explain your reasoning.

Before issuing your verdict on any finding, complete these mandatory pre-flights:

TRANSACTION PRE-FLIGHT — if any agent flagged missing transaction wrapper:
Answer explicitly: is each mutation idempotent? If every mutation produces the same
database row state on re-run (fixed-value SET, INSERT ... ON CONFLICT DO UPDATE),
the function self-heals on retry — the caller re-invokes and the function reaches
a consistent state. Identify the specific failure mode that idempotency does NOT
cover. If you cannot, clear the transaction finding. Do not let "atomicity is
important" or "multiple mutations need coordination" override this check — those
are heuristics that are false when all mutations are idempotent.

PARAMETERIZATION PRE-FLIGHT — if any agent flagged SQL injection on template literals:
Trace the interpolated values. If all are parameter placeholder tokens or
index-arithmetic expressions that produce placeholder tokens, the query is correctly
parameterized. No user input in the SQL string = no injection. Clear the finding.

RETURN VALUE PRE-FLIGHT — if any agent flagged inaccurate return values:
Determine the documented return contract. If the return type documents intent counts
(records processed for a state change) rather than net-new rows, re-activations are
correct per contract. Clear the finding if the implementation matches the documented
contract.

DATA HANDLING PRE-FLIGHT — if you plan to flag missing validation, normalization, or
deduplication: Before raising this finding, check the first 5 lines of the function
for existing handling of the specific data concern. If the function already validates,
normalizes, or deduplicates the relevant input before it reaches the code you are
reviewing, do not raise the absence as a finding. Only flag if the handling is
genuinely absent for data that reaches the logic in question.

When all agents agree unanimously on a finding: pressure-test it harder, not less.
Unanimous findings may reflect shared checklist-mode pattern matching. Ask: is this
grounded in the specific semantics of this code, or does it pattern-match a general
heuristic?

Code:
[CODE]

Round 1 findings:
[ROUND_1_OUTPUTS]

Round 2 rebuttals:
[ROUND_2_OUTPUTS]
```

Collect Arbiter's output before proceeding to Compass.

---

## Validation — Compass

Spawn compass-review with all outputs and the answer key.

---

**Compass prompt:**
```
You are scoring a structured code review debate. Below is a code sample, two rounds
of agent debate, and Arbiter's synthesis verdict. Score the debate against the answer key.

Code:
[CODE]

Round 1 findings:
[ROUND_1_OUTPUTS]

Round 2 rebuttals:
[ROUND_2_OUTPUTS]

Arbiter's synthesis:
[NANDO_OUTPUT]

Answer key — expected false positives (all are correct as written):
[ANSWER_KEY_FP_LIST]

Expected real issues:
[ANSWER_KEY_REAL_LIST]

For each expected false positive, classify its outcome using this rubric:
- GATE SUPPRESSED (PASS): Not flagged in Round 1 — pre-flight gate prevented the finding
- SELF-CORRECTED (PASS): Flagged R1 → challenged R2 → cleared by Arbiter
- LATE CLEAR (PASS): Flagged R1 → not challenged R2 → cleared by Arbiter
- SPLIT: Idempotency/FP aspect cleared; a genuinely different concern correctly preserved
- UPHELD (FAIL): Raised in R1 and not cleared by Arbiter

Count PHANTOM issues only. A phantom is a finding where the code demonstrably does NOT
have the problem claimed — i.e., the claim is factually incorrect about what the code
actually does. Do NOT count as phantoms: real production concerns that are out of scope
for this code unit (input validation, logging, observability, etc.) — agents are correct
to raise those even if not in the answer key. Only count claims that are objectively
false given the actual code.

Write a 1-2 paragraph debrief: what the Forgeflow team got right, what lingered too long,
what agent behaviour should be investigated.

Produce your output in this exact format:

## Compass's Validation
| Expected False Positive | Outcome | Flagged R1 | Challenged R2 | Cleared by Arbiter | Notes |
|---|---|---|---|---|---|
[one row per FP from the answer key — Outcome column uses rubric above]

**False positives correctly handled:** X / N
**Phantom issues invented:** N
**Verdict:** PASS / PARTIAL / FAIL

PASS = all FPs handled correctly (any GATE SUPPRESSED, SELF-CORRECTED, LATE CLEAR, or SPLIT)
PARTIAL = 50–99% handled correctly, or 1+ UPHELD with majority passing
FAIL = any FP UPHELD with <50% handling correctly, or majority UPHELD

## Debrief
[1-2 paragraphs]
```

---

## Save the Report

```bash
mkdir -p .forgeflow/debate-reports
```

Write the full report to:
`.forgeflow/debate-reports/YYYY-MM-DD-[scenario-slug].md`

Use this template:

```markdown
# Debate Report — [Scenario Name]
**Date:** YYYY-MM-DD
**Code:** [filename or description]

---

## Round 1 — Openings

### Smith
[Smith Round 1 output]

### Warden
[Warden Round 1 output]

### Lumen
[Lumen Round 1 output]

### Atlas
[Atlas Round 1 output]

---

## Round 2 — Rebuttals

### Smith
[Smith Round 2 output]

### Warden
[Warden Round 2 output]

### Lumen
[Lumen Round 2 output]

### Atlas
[Atlas Round 2 output]

---

## Round 3 — Arbiter's Synthesis

[Arbiter output]

---

## Compass's Validation
[Compass output — scorecard + debrief]
```
