# Recurring Blocker Classes — Tier A

Global pattern library for Atlas and Arbiter to reference during `/plan`, `/consult`, and `/review`. A pattern appears here when it has been flagged as a BLOCKER or high-severity REVISE in 2+ projects.

Updated by `/forgeflow-learnings` (monthly) or manually from project review histories.

---

## 1. Type Safety & Schema Mismatches

**Pattern:** Schema definitions diverge between Drizzle / TypeScript / SQL migrations / API contracts. Consumers assume one shape; storage has another.

**Seen in:**
- `campaign-management` (2026-03-24 learnings) — `email_sends` spec uses enum missing `'pending'` vs live `campaign_send_log` varchar status; `sendTypeEnum` defined locally, migration requires creating shared constants file
- `llama.cpp` (patterns.md) — `src1` (activations) restricted to F32 only but never checked at graph_compute entry; positional brace-init without field names silently assigns wrong values when upstream `ggml_backend_dev_caps` gains a field

**Classification:** Typically BLOCKER. Silent data corruption risk, not just a lint issue.

**Plan-time preemption:**
When a plan introduces or modifies an enum, union type, or schema definition:
- Flag: "Does this type appear in multiple consumers? Search for usages before finalizing the values."
- Require: a note in the spec identifying all consumers, not just the primary one.

**Implement-time check (Smith):**
- Grep for the old type name across the tree before removing or renaming
- If a shared constants file doesn't exist for this domain, create one in Phase 1 — do not inline the enum in the consumer

**Review-time check (Smith, Warden):**
- Verify the type signature matches every call site, not just the one in the diff
- Check migration INSERT / UPDATE statements against the new schema — nullable vs notNull mismatches will fail at runtime

---

## 2. Unimplemented / Promised-But-Missing Features

**Pattern:** Spec or prior-phase output promises a function / stat / constant / field. Implementation skips it silently. Reviews later catch the gap as a blocker.

**Seen in:**
- `campaign-management` (2026-03-24 through 2026-04-01 learnings) — `extractVariables()` and `warmCache()` promised but not implemented; Phase 5 spec shows Bounced stat but `totalBounced` missing from hook; `CAMPAIGN_SUPPRESSION_REASON` constant existence unconfirmed
- `SubAgents` (2026-03-25 debate learnings) — Warden wrong-channel gap was not addressed in `warden-review.md` despite being assigned; no output routing rule added
- `llama.cpp` (patterns.md) — functions declared with fallback paths that were never wired up

**Classification:** Typically REVISE. Not data-breaking, but the downstream tests and reviews fail.

**Plan-time preemption:**
For any plan that declares named functions, stats, or constants:
- Require an acceptance criterion per named artifact: "<name> exists and is called by <caller>"
- Atlas pushes back on plans that list N artifacts but only N-1 acceptance criteria.

**Implement-time check (Compass validation tests):**
- Every spec'd artifact gets at least one automated or manual check
- Missing implementations fail the validation checklist at `/implement` end, not at `/review`

**Review-time check (Atlas):**
- Cross-reference plan artifacts vs implemented artifacts
- Flag any declared-but-not-implemented as MUST-FIX with spec citation

---

## 3. Null-Safety & Error-Path Gaps

**Pattern:** Code assumes a value is non-null, or assumes an error path throws rather than returns silently. Reality: the value can be null, or the error is swallowed.

**Seen in:**
- `campaign-management` (2026-03-28 through 2026-04-02 learnings) — `whitelist_active` mode has no runtime production guard; `email_suppressions` unique constraint with nullable `storeId` (NULL != NULL so duplicates allowed); `from_address` nullable but spec is notNull so migration INSERT fails
- `llama.cpp` (patterns.md) — `try_init_context` returns false (not throws) when env vars absent; `GGML_ABORT` in graph_compute if op reaches execution that `supports_op` should have blocked; `device_get_memory` reports 0/0 — no observability

**Classification:** BLOCKER when the gap can cause silent data corruption or production outage; REVISE when it's recoverable.

**Plan-time preemption:**
Any plan touching auth, data writes, external API calls, or user-supplied input:
- Requires an explicit "Error paths" section listing what can fail and how
- Atlas pushes back on "happy path only" plans

**Implement-time check (Warden, Smith):**
- Every nullable column → verify every read includes a null branch
- Every external call → explicit timeout + error path
- Every boolean-returning "try" function → caller checks return and handles false case

**Review-time check (Warden):**
- Run the security checklist Tier 1 items on every diff touching auth / data writes / external calls
- Null-safety gap in production code path → BLOCKER, not REVISE

---

## Promotion criteria for new patterns

A pattern qualifies for this file when it meets all of:
1. Flagged as BLOCKER or high-severity REVISE
2. Appeared in ≥2 distinct projects (not just 2 instances in one project)
3. Has a concrete citation (file:line or spec reference) in each project
4. Has a general-purpose plan-time or review-time check that would preempt future instances

Seeded from `/insights` analysis of `.forgeflow/` data across campaign-management, llama.cpp, and SubAgents projects on 2026-04-17.
