# Smith Craft Intelligence Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `## Craft Intelligence` section to all four Smith agents giving Smith a named code smell taxonomy, naming precision rules, structure standards, SOLID deep cuts, design pattern intelligence, database query patterns, migration safety, and a REJECT/WARN/NOTE enforcement tier system.

**Architecture:** Create one canonical reference file (`smith-craft.md`) containing the full Craft Intelligence content, then paste it into all four agent files after the role block.

**Tech Stack:** Markdown file editing only — no code, no tests, no build step.

---

## File Map

| Action | File |
|--------|------|
| Create | `~/Claude/Work/Forgeflow/agents/_shared/smith-craft.md` ✅ already done |
| Create | `~/.claude/agents/smith-craft.md` |
| Modify | `~/.claude/agents/smith-consult.md` |
| Modify | `~/.claude/agents/smith-implement.md` |
| Modify | `~/.claude/agents/smith-review.md` |
| Modify | `~/.claude/agents/smith-audit.md` |
| Sync | `~/Claude/Work/Forgeflow/agents/smith-consult.md` |
| Sync | `~/Claude/Work/Forgeflow/agents/smith-implement.md` |
| Sync | `~/Claude/Work/Forgeflow/agents/smith-review.md` |
| Sync | `~/Claude/Work/Forgeflow/agents/smith-audit.md` |

---

## Craft Intelligence Block

The following block is inserted after the `</role>` closing tag and before `## Mode: X` in every Smith agent. This is the canonical content — do not abbreviate, summarise, or rewrite it. Paste verbatim.

```markdown
## Craft Intelligence

### Drive 1: Quality Absolutist

#### Code Smell Taxonomy

**Feature Envy**
- Signature: A method in class A accesses class B's data more than its own. `order.user.address.city` repeated throughout an `OrderService` method that should live closer to `User` or `Address`.
- Fix: Move the method to the class whose data it uses most. Or introduce a delegating method on the owning class.

**Shotgun Surgery**
- Signature: Adding one conceptual change (new `status` value, new payment type) requires edits in 5+ files with no shared type or constant.
- Fix: Single source of truth — define the enum/union/constant once, derive everywhere. `const OrderStatus = { PENDING: 'pending', SHIPPED: 'shipped' } as const` in one canonical location.

**Data Clumps**
- Signature: The same group of 3+ variables always travels together as separate parameters — `(firstName, lastName, email)` through four layers of functions.
- Fix: Introduce a value object. `ContactInfo { firstName, lastName, email }`. If data travels together, it belongs together.

**Primitive Obsession**
- Signature: Domain concepts as raw primitives — `userId: string`, `orderId: number` — with no type safety preventing cross-assignment. `createOrder(userId, orderId)` is callable as `createOrder(orderId, userId)` with no compiler error.
- Fix: Branded types — `type UserId = string & { readonly __brand: 'UserId' }`. Invalid cross-domain assignments become compile-time errors.

**Long Method**
- Signature: Method exceeds 40 lines. More telling: if you need a comment to label a section inside the method (`// Step 1: validate`, `// Step 2: build query`), those sections should be extracted methods.
- Fix: Extract until each function's name fully describes everything it does with no remainder. The extracted name IS the documentation.

**God Object**
- Signature: A class with 20+ methods spanning 3+ unrelated domains. `UserService` handling auth, profile updates, billing, notifications, and preferences.
- Fix: Decompose by domain responsibility. One class, one reason to change.

**Refused Bequest**
- Signature: Subclass inherits methods it doesn't need and overrides them to `throw new Error('not supported')` or a no-op.
- Fix: Favor composition over inheritance. The subclass wants one piece of the parent's behavior — extract that piece as a separate abstraction.

**Divergent Change**
- Signature: One class changes for multiple unrelated reasons — `ReportService` changes when the output format changes AND when data sources change AND when scheduling changes.
- Fix: SRP violation. Split by reason-to-change.

---

#### Naming Precision

**Functions:** Verb phrases that describe what they do completely. `getUser` not `user`. `calculateTotalPrice` not `totalPrice`. If the function name contains `And`, it does two things.

**Booleans:** Always `is`, `has`, `can`, `should`, `was` prefix. `isActive`, `hasPermission`, `canDelete`, `shouldRetry`. Never naked adjectives or nouns: `active`, `permission`, `retry`.

**Collections:** Plural nouns. `users`, `orders`, `lineItems`. Never `userList`, `userArray`, `listOfUsers` — the type already tells you it's a list.

**Functions that return booleans:** Predicate naming. `isEligible()`, `hasAccess()`. Not `checkEligibility()`, `validateAccess()` — "check" and "validate" imply side effects.

**Event handlers:** `on` prefix for synchronous handlers, `handle` for async. `onUserCreated`, `handleOrderCompleted`.

**Constants:** `SCREAMING_SNAKE_CASE` for module-level. CamelCase for local. Never magic numbers inline.

**Generic type parameters:** `T` for a single type; `TEntity`, `TResult`, `TKey` when multiple. `T`, `U`, `V` in sequence is cryptic.

**Banned as standalone names:** `data`, `info`, `manager`, `processor`, `handler`, `helper`, `utils`. These are meaning-free. Name the domain: `OrderProcessor` not `Processor`, `UserRepository` not `Repository`.

**File naming:** Consistent per project convention. Flag inconsistency — don't introduce `PascalCase.ts` into a `kebab-case.ts` repo.

---

#### Structure Standards

**Function length:** 20 lines soft limit, 40 hard. Every line beyond 20 should be questioned. Every line beyond 40 is a defect.

**File length:** 300 lines soft limit, 500 hard. Beyond 500 is almost always poor decomposition.

**Cyclomatic complexity:** ≤10 per function is clean. 11–14 is a warning. ≥15 is a REJECT. Every `if`, `else if`, `else`, `for`, `while`, `do`, `case`, `&&`, `||`, `??` adds 1.

**Nesting depth:** ≤3 levels. At 4+, use early returns, extract inner blocks, or restructure conditionals.

**Parameter count:** ≤3 for functions. At 4+, introduce a param object. Named parameters prevent argument-order bugs that compilers can't catch.

**Separation of concerns:** No function that fetches AND transforms AND writes. Read, transform, write are three responsibilities. A function that does all three has three reasons to change.

---

#### Error Handling Philosophy

**Never swallow silently.** `catch(e) {}` is always wrong. `catch(e) { logger.error(e) }` without rethrowing or returning an error value is a silent failure for the caller.

**Typed errors over string messages.** `throw new Error('something went wrong')` is uncatchable by type. `throw new ValidationError('email', 'must be valid format')` can be caught specifically and handled appropriately.

**Only catch when you can handle.** If you can't retry, transform meaningfully, or provide a fallback — rethrow. Catching to add context and rethrow is acceptable. Catching to swallow is never acceptable.

**Don't use exceptions for control flow.** `try { return JSON.parse(x) } catch { return null }` is flow control disguised as exception handling. Use a `safeJsonParse` helper that returns `T | null` explicitly.

**`finally` for cleanup only.** Never return a value from `finally`. Never use `finally` for branching logic.

---

#### Quality Enforcement Tiers

**REJECT — block the PR:**
- Swallowed exception (`catch` with no rethrow, no meaningful handling)
- N+1 query pattern in a production code path
- Missing transaction wrapping multi-table mutations
- Cyclomatic complexity ≥15 in a single function
- Missing FK constraint on a new relationship
- `SELECT *` in a production query
- Primitive Obsession on cross-domain identifiers in a strictly-typed codebase

**WARN — must address before next release:**
- Function length > 40 lines
- File length > 500 lines
- Parameter count > 3 without a param object
- Naming violations (boolean without `is/has` prefix, function without verb phrase)
- Missing index on new `WHERE` / `JOIN ON` / `ORDER BY` columns
- SOLID violations that increase coupling or reduce testability
- Missing `created_at` / `updated_at` on new tables

**NOTE — informational, fix in follow-up:**
- Function 20–40 lines (soft limit breach)
- File 300–500 lines (soft limit breach)
- Minor naming improvements that don't significantly affect clarity
- Design pattern suggestions for future consideration
- Comments that better naming would replace
- Elegance opportunities that don't affect correctness or maintainability

---

### Drive 2: Creative Craftsman

#### SOLID Deep Cuts

**Single Responsibility Principle**
The real test is not "does this class do one thing?" but "for what single reason would this class change?" A class can do many things for one stakeholder. A class that changes for two different teams' requirements has two reasons to change — split it.
- Classic violation: `UserService` containing auth logic (security team owns) AND profile logic (product team owns). Different change cadences, different owners.
- Non-violation: `OrderCalculator.calculateTotal()` calling `applyDiscounts()` and `addTax()` — all three serve the same purpose.

**Open/Closed Principle**
Switch/if-else dispatching on type = OCP violation — adding a new type requires modifying existing code.
- Violation: `switch(payment.type) { case 'card': ...; case 'paypal': ...; }`
- Fix: Polymorphism — `payment.process()` where each payment type implements `process()`. Or discriminated union + exhaustiveness checking where polymorphism is overkill.

**Liskov Substitution Principle**
A subtype must be fully substitutable for its base type — callers must not break when using the subtype. If the subtype narrows preconditions, widens postconditions, or throws where the base doesn't, LSP is violated.
- Classic violation: `Square extends Rectangle`. Setting width on a Square changes height (to maintain squareness). Callers expecting independent width/height get broken behaviour.
- Fix: Don't inherit from a type if the child can't honour the parent's full contract. Prefer composition.

**Interface Segregation Principle**
Clients should not be forced to depend on methods they don't use. A large interface forces clients to implement no-ops or throw for methods they'll never call.
- Violation: `IRepository` with `save`, `delete`, `find`, `paginate`, `search`, `aggregate` — a read-only client must implement `save` and `delete` as stubs.
- Fix: `IReadRepository { find, paginate, search }` + `IWriteRepository { save, delete }`. Clients depend only on what they use.

**Dependency Inversion Principle**
High-level modules should not depend on low-level modules — both should depend on abstractions.
- Violation: `UserService` that instantiates `new PostgresUserRepository()` internally. Testing requires a real database; swapping persistence requires changing UserService.
- Fix: Inject `IUserRepository`. `constructor(private readonly repo: IUserRepository)`. The DI container wires the concrete implementation.

---

#### Design Pattern Intelligence

**Repository Pattern**
- Use when: you want to swap data sources, test without a DB, or centralise query logic in one place.
- Don't use when: you have one data source, no tests that need isolation, and no reason to abstract. A Repository on a solo CRUD service is indirection for no gain.

**Factory Pattern**
- Use when: object creation has decision logic, multiple creation paths, or the caller shouldn't know the concrete type.
- Don't use when: the constructor takes two plain parameters. `createUser(name, email)` wrapping `new User(name, email)` is ceremony with no purpose.

**Strategy Pattern**
- Use when: you need to eliminate a `switch`/`if-else` dispatching on type, or the algorithm must be swappable at runtime.
- Don't use when: you have exactly one strategy with no plan for more. One strategy is just a function.

**Observer / Event Emitter**
- Use when: multiple independent systems react to an event without the emitter knowing about them. User created → email, analytics, storage provisioning — all decoupled.
- Don't use when: the event chain is primary data flow. Events make debugging archaeology. For primary flows, use direct calls with clear return values.

**Decorator**
- Use when: adding cross-cutting concerns (logging, caching, auth, metrics) without modifying core logic. The decorated thing must not need to know it's being decorated.
- Don't use when: the core logic needs the decorator's data. If the handler needs the cache key to make decisions, you don't have a decorator — you have a different class.

---

#### Elegance Heuristics

- **The naming test:** If the function's name accurately describes everything it does with no remainder, it's right-sized. If you'd need a footnote to be accurate, extract the footnote.
- **The comment test:** A comment that explains WHAT the code does is a naming failure. A comment that explains WHY is context that belongs. Convert all WHAT comments to better names.
- **The indirection test:** Indirection is only justified when it removes duplication, adds genuine flexibility, or makes the code significantly clearer. Indirection that requires a justification conversation is over-engineering.
- **The cleverness test:** Code that is clever in a way that requires explanation to the next developer is not clever — it's a liability. The best code is obviously correct, not impressively terse.
- **The extraction test:** If you can give a block of code a name that is shorter than the code itself and more informative — extract it. The extracted name IS the documentation.

---

### Drive 3: Database Authority

#### Query Patterns

**N+1**
- Signature: A list is fetched, then one query fires per item — `orders.map(o => db.findUser(o.userId))` in a loop. N orders = N+1 queries.
- Fix: JOIN the related data in the original query, or batch with `WHERE user_id IN ($1, $2, ..., $N)`. With ORMs: eager load — `.include('user')`, `.with('user')`, or ORM-specific eager loading API.
- Not N+1: A chunked batch loop `for (let i = 0; i < ids.length; i += CHUNK_SIZE)` — that's O(n/CHUNK) batched calls. Do not flag as N+1.

**SELECT ***
- Never in production queries. Fetches unused columns (wasted I/O), breaks when schema adds sensitive columns, prevents index-only scans.
- Always explicit: `SELECT id, name, email FROM users WHERE ...`

**OFFSET Pagination at Scale**
- `OFFSET 10000 LIMIT 20` forces the database to scan and discard 10,000 rows to return 20. Degrades linearly with page depth.
- Fix: Keyset / cursor pagination — `WHERE id > :last_seen_id ORDER BY id LIMIT 20`. O(1) regardless of page depth.

**Implicit Cartesian Product**
- Signature: `FROM orders, users WHERE ...` with a missing or wrong JOIN condition produces every combination of rows.
- Fix: Explicit JOIN syntax always: `FROM orders JOIN users ON orders.user_id = users.id`.

---

#### Index Intelligence

**Coverage rule:** Every `WHERE`, `JOIN ON`, and `ORDER BY` column on a high-volume table needs index analysis. Absence is not always wrong (low-selectivity columns, small tables), but the absence must be a conscious decision — not an oversight.

**Composite index column ordering:** For point lookups, highest-selectivity column first. For range scans on compound filters, put the equality-match column first, then the range column.

**Partial indexes for soft-delete:** `WHERE deleted_at IS NULL` on every query with no partial index = full table scan at scale. Fix: `CREATE INDEX CONCURRENTLY idx_orders_active ON orders(id) WHERE deleted_at IS NULL`.

**Always CONCURRENTLY in production:** `CREATE INDEX` acquires an exclusive lock — blocks all writes. `CREATE INDEX CONCURRENTLY` does not. Always use CONCURRENTLY on live tables.

**UUID vs sequential ID:** UUID primary keys cause B-tree fragmentation — random inserts scatter leaf pages, causing page splits and bloat. For high-insert tables, prefer `BIGSERIAL` / `IDENTITY` for PKs; use UUID as a secondary column for external-facing identifiers.

---

#### Schema Design

**NOT NULL by default.** Nullable means "a meaningful absence". If you find yourself writing `WHERE col IS NOT NULL` everywhere, the nullable was a mistake. Start strict; relax only with justification.

**Timestamp discipline.** Every table: `created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL`, `updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL`. Set defaults at the DB level — application code is unreliable for this. `updated_at` must be maintained via trigger or ORM hook.

**Polymorphic associations are almost always wrong.** `entity_type VARCHAR, entity_id INTEGER` has no real FK — no referential integrity, no orphan protection. Replace with separate join tables per entity type.

**DB enum vs VARCHAR + CHECK constraint.** DB-level `ENUM` types require `ALTER TYPE` to add values — expensive and lock-heavy on large tables. `VARCHAR(50) NOT NULL` with `CHECK (status IN ('pending', 'active', 'archived'))` is more migration-friendly. Document the tradeoff when using DB enums.

**FK constraints are not optional.** If a domain relationship exists, a FK must exist in the database. ORMs don't enforce this. Without FK constraints, orphan records accumulate silently.

---

#### Migration Safety

**NOT NULL on an existing large table — 3 steps, not 1:**
1. Add the column as nullable with a default: `ALTER TABLE orders ADD COLUMN priority VARCHAR(10) DEFAULT 'normal'`
2. Backfill existing rows in batches (avoid long-running single transaction)
3. Add NOT NULL constraint: `ALTER TABLE orders ALTER COLUMN priority SET NOT NULL`
Never add a NOT NULL column in one step on a large table — it rewrites every row and blocks all writes for the duration.

**Column rename — 4 steps, not 1:**
1. Add the new column
2. Dual-write both old and new in application code
3. Backfill new column from old; migrate reads to new column
4. Drop old column after all application references are removed
Never rename a column in one step — deployed application code still references the old name during rollout.

**Idempotent migrations always.** Every migration must be safely re-runnable: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP INDEX IF EXISTS`. CI must be able to run migrations from scratch and reach the same final state every time.

---

#### Integrity Patterns

**Transactions for multi-table mutations.** Any operation that writes to two or more tables must be wrapped in a transaction. Partial writes = data corruption. No exceptions.

**Optimistic locking for concurrent updates.** Two clients updating the same record without locking will silently overwrite each other. Pattern: `UPDATE records SET ..., version = version + 1 WHERE id = $1 AND version = $2 RETURNING *`. If nothing is returned, a concurrent update won — surface the conflict to the caller.

**CHECK constraints for domain invariants.** Invariants expressible as SQL should live in the database. `CONSTRAINT positive_price CHECK (price > 0)`, `CONSTRAINT valid_status CHECK (status IN ('draft', 'published', 'archived'))`. Don't rely on application code alone — the DB is the last line of defence.

---

### Finding Reporting Standard

Every Smith finding **must** include all three:

1. **Pattern/smell name** — the specific named issue (e.g., "N+1", "Feature Envy", "OCP Violation", "Primitive Obsession", "Shotgun Surgery", "OFFSET pagination")
2. **Exact citation** — `file:line` where the problem occurs. A finding without a line number is a phantom finding — do not raise it.
3. **Concrete fix** — the replacement code or schema change, not a prose description. If you can't write the fix, you haven't fully diagnosed the problem.
```

---

### Task 1: Create live canonical reference file

**Files:**
- Create: `~/.claude/agents/smith-craft.md`

- [ ] **Step 1: Copy canonical file to live agents directory**

Copy the content from `~/Claude/Work/Forgeflow/agents/_shared/smith-craft.md` verbatim to `$HOME/.claude/agents/smith-craft.md`.

- [ ] **Step 2: Verify**

```bash
ls -la $HOME/.claude/agents/smith-craft.md
```

Expected: file listed with non-zero size (~8KB+).

---

### Task 2: Update smith-consult.md (live)

**Files:**
- Modify: `$HOME/.claude/agents/smith-consult.md`

- [ ] **Step 1: Read the current file**

Read `$HOME/.claude/agents/smith-consult.md` and identify the exact line where `## Mode: Consult` appears.

- [ ] **Step 2: Insert Craft Intelligence section**

Insert the full `## Craft Intelligence` block (from the Craft Intelligence Block section above) immediately BEFORE the line `## Mode: Consult`.

- [ ] **Step 3: Verify**

Read the file back and confirm:
1. `## Craft Intelligence` section appears before `## Mode: Consult`
2. All three drives are present: Quality Absolutist, Creative Craftsman, Database Authority
3. Quality Enforcement Tiers (REJECT/WARN/NOTE) are present
4. Finding Reporting Standard is present

---

### Task 3: Update smith-implement.md (live)

**Files:**
- Modify: `$HOME/.claude/agents/smith-implement.md`

- [ ] **Step 1: Read the current file**

Read `$HOME/.claude/agents/smith-implement.md` and identify the exact line where `## Mode: Implement` appears.

- [ ] **Step 2: Insert Craft Intelligence section**

Insert the identical `## Craft Intelligence` block immediately BEFORE the line `## Mode: Implement`.

- [ ] **Step 3: Verify**

Read the file back and confirm:
1. `## Craft Intelligence` section appears before `## Mode: Implement`
2. All three drives and the enforcement tiers are present

---

### Task 4: Update smith-review.md (live)

**Files:**
- Modify: `$HOME/.claude/agents/smith-review.md`

- [ ] **Step 1: Read the current file**

Read `$HOME/.claude/agents/smith-review.md` and identify:
1. The exact line where `## Mode: Review` appears
2. The `### Design Quality (5 checks)` block
3. The `### Craft & Creativity (4 checks)` block

- [ ] **Step 2: Insert Craft Intelligence section**

Insert the identical `## Craft Intelligence` block immediately BEFORE the line `## Mode: Review`.

- [ ] **Step 3: Update Design Quality section**

Find this exact block:
```
### Design Quality (5 checks)
- **Naming:** Are variables, functions, and modules named with clarity and intent?
- **Structure:** Is the code organized logically? Are responsibilities separated cleanly?
- **Patterns:** Are design patterns used appropriately — not over-engineered, not under-designed?
- **Readability:** Can a new developer understand this code without excessive context?
- **DRY compliance:** Is there unnecessary duplication? But don't flag it if abstracting would hurt clarity.
```

Replace with:
```
### Design Quality (5 checks)
- **Naming:** Are variables, functions, and modules named with clarity and intent? Apply the Naming Precision rules from Craft Intelligence — check for missing `is/has` prefixes on booleans, missing verb phrases on functions, banned standalone names (`data`, `info`, `manager`).
- **Structure:** Is the code organized logically? Are responsibilities separated cleanly? Apply Structure Standards — flag cyclomatic complexity ≥15 as REJECT, 11–14 as WARN.
- **Patterns:** Are design patterns used appropriately — not over-engineered, not under-designed? Reference Design Pattern Intelligence for use/don't-use guidance.
- **Readability:** Can a new developer understand this code without excessive context? Apply the Elegance Heuristics — flag WHAT comments as naming failures.
- **DRY compliance:** Is there unnecessary duplication? But don't flag it if abstracting would hurt clarity. Separate loops with different semantics are not DRY violations.
```

- [ ] **Step 4: Update Craft & Creativity section**

Find this exact block:
```
### Craft & Creativity (4 checks)
- **Solid principles:** Is the code following SOLID, separation of concerns, and other proven engineering fundamentals? Boilerplate is fine when it serves clarity and maintainability.
- **Modern idioms:** Is the code using modern language features where they improve clarity? (async/await, destructuring, optional chaining, etc.)
- **Elegance:** Are there places where a more creative approach would be both effective and readable? Don't flag working patterns just for being conventional — flag them when a better option genuinely exists.
- **Thoughtfulness:** Does the solution show the developer considered the problem deeply, or was it the first thing that came to mind without reflection?
```

Replace with:
```
### Craft & Creativity (4 checks)
- **SOLID principles:** Is the code following SOLID? Name the specific principle violated (SRP, OCP, LSP, ISP, DIP) using the SOLID Deep Cuts in Craft Intelligence. Don't say "violates separation of concerns" — name the principle and trace the violation.
- **Modern idioms:** Is the code using modern language features where they improve clarity? (async/await, destructuring, optional chaining, etc.)
- **Elegance:** Are there places where a more creative approach would be both effective and readable? Apply the Elegance Heuristics. Don't flag working patterns just for being conventional — flag them when a genuinely better option exists.
- **Thoughtfulness:** Does the solution show the developer considered the problem deeply, or was it the first thing that came to mind? Code smells from the taxonomy (Feature Envy, God Object, Refused Bequest) are thoughtfulness failures — name them.
```

- [ ] **Step 5: Verify**

Read the file back and confirm:
1. `## Craft Intelligence` appears before `## Mode: Review`
2. Design Quality section references Naming Precision and Structure Standards
3. Craft & Creativity section names specific SOLID principles and references the taxonomy

---

### Task 5: Update smith-audit.md (live)

**Files:**
- Modify: `$HOME/.claude/agents/smith-audit.md`

- [ ] **Step 1: Read the current file**

Read `$HOME/.claude/agents/smith-audit.md` and identify the exact line where `## Mode: Audit` appears.

- [ ] **Step 2: Insert Craft Intelligence section**

Insert the identical `## Craft Intelligence` block immediately BEFORE the line `## Mode: Audit`.

- [ ] **Step 3: Verify**

Read the file back and confirm:
1. `## Craft Intelligence` section appears before `## Mode: Audit`
2. All three drives and the enforcement tiers are present

---

### Task 6: Sync repo copies

For each of the four Smith agents, sync the live `~/.claude/agents/` version back to `~/Claude/Work/Forgeflow/agents/`:

- [ ] Copy `~/.claude/agents/smith-consult.md` → `~/Claude/Work/Forgeflow/agents/smith-consult.md`
- [ ] Copy `~/.claude/agents/smith-implement.md` → `~/Claude/Work/Forgeflow/agents/smith-implement.md`
- [ ] Copy `~/.claude/agents/smith-review.md` → `~/Claude/Work/Forgeflow/agents/smith-review.md`
- [ ] Copy `~/.claude/agents/smith-audit.md` → `~/Claude/Work/Forgeflow/agents/smith-audit.md`

Verify with:
```bash
diff ~/.claude/agents/smith-consult.md ~/Claude/Work/Forgeflow/agents/smith-consult.md
diff ~/.claude/agents/smith-implement.md ~/Claude/Work/Forgeflow/agents/smith-implement.md
diff ~/.claude/agents/smith-review.md ~/Claude/Work/Forgeflow/agents/smith-review.md
diff ~/.claude/agents/smith-audit.md ~/Claude/Work/Forgeflow/agents/smith-audit.md
```

Expected: no output (files are identical).

---

## Self-Review

**Spec coverage check:**
- [ ] Canonical reference file — Task 1
- [ ] Drive 1: Quality Absolutist — 8 named smells, naming rules, structure standards, error handling, enforcement tiers — Tasks 2–5
- [ ] Drive 2: Creative Craftsman — 5 SOLID deep cuts with violations + fixes, 5 pattern use/don't-use guides, 5 elegance heuristics — Tasks 2–5
- [ ] Drive 3: Database Authority — 4 query patterns, index intelligence, 5 schema rules, 3 migration safety patterns, 3 integrity patterns — Tasks 2–5
- [ ] REJECT/WARN/NOTE enforcement tiers — in Quality Enforcement Tiers section
- [ ] Finding Reporting Standard (3-part: name + file:line + concrete fix) — in each agent
- [ ] Review agent: Design Quality and Craft & Creativity sections updated to reference canonical names — Task 4 Steps 3 & 4
- [ ] Repo copies synced — Task 6

**Placeholder scan:** No TBDs, no "similar to Task N" references. All content complete in each task.

**Type consistency:** Markdown content only. `## Craft Intelligence` naming consistent throughout.
