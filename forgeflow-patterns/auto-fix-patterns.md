# Auto-Fix Patterns

Classification of findings that `/review-auto` can handle autonomously vs findings that must surface to the user. Used by the `/review-auto` classifier at Step 2 and by reviewers to frame their findings in auto-fix-friendly language.

Seeded with forward-looking rules on 2026-04-17 (no `/review-auto` telemetry yet). Updated by `/forgeflow-learnings` as real outcomes accumulate.

---

## NIT — Auto-applies reliably

These finding classes route to `NIT` tier and auto-apply with ~95% worker success rate.

| Class | Example | Target agent |
|---|---|---|
| **Formatting only** | `prettier --write` equivalent | Smith implement |
| **Unused imports** | `import { unusedX } from './lib'` | Smith implement |
| **Missing `const`/`let`** | `var x = 1` → `const x = 1` | Smith implement |
| **Missing return in void handler** | handler declared `void` but has implicit return | Smith implement |
| **Missing aria-label on icon-only button** | `<button><Icon /></button>` | Lumen implement |
| **Missing semicolons (if project uses them)** | lint autofix territory | Smith implement |

**Why reliable:** Each is single-file, purely textual, no behavior change, validated by lint/typecheck after.

---

## MUST-FIX-SAFE — Auto-applies with tighter guardrails

These route to `MUST-FIX-SAFE` and auto-apply only when the worker prompt can constrain scope to a single file and no API surface change. ~80% worker success.

| Class | Example | Notes |
|---|---|---|
| **Missing null guard on known-nullable** | `user.email.trim()` where `user.email` is `string \| null` | Worker adds `if (!user.email) return ...` |
| **Missing `await` on promise** | `const x = asyncFn();` where `x` is then used as value | Worker adds `await` |
| **Narrower type where wider type was inferred** | `any` that should be a known union | Worker adds explicit type annotation |
| **Deprecation warnings** | `componentWillMount` → `componentDidMount` | Only when the replacement is 1:1 |

**Why constrained:** Changes behavior slightly. Validation gate (typecheck + tests) must pass after. Rolled back on failure.

---

## MUST-FIX-RISKY — Always surface, never auto-apply

These classes surface to the user even if the tier heuristics say "safe". The downside of wrong auto-application is too high.

| Class | Why not auto | Surfaced to |
|---|---|---|
| **Anything flagged by Warden** | Security-adjacent "safe" doesn't exist | User |
| **Migrations** | Schema changes can lose data | User |
| **package.json dependencies** | Version changes are load-bearing | User |
| **Auth / session / permissions** | Silent change to access control | User |
| **Multi-file changes** | Worker prompt constrains to 1 file; multi-file needs design | User |
| **API contract changes** | Breaking changes affect consumers outside the diff | User |
| **Reviewer uncertainty** ("consider", "might", "perhaps") | Ambiguous findings need human judgment | User |
| **Database migrations with data backfill** | Order matters, rollback risk | User |

---

## BLOCKER — Surface with context, never auto-apply

Blockers always surface with full detail. Additionally include:
- Which reviewer flagged it
- Which recurring blocker class (from `recurring-blockers.md`) it matches, if any
- A recommended path: `/consult` if design issue, `/discuss` if requirements unclear, or direct fix if scope is clear

---

## Classifier decision flow (Step 2 of `/review-auto`)

```
For each finding:
  1. Source reviewer? If Warden → MUST-FIX-RISKY (hard rule)
  2. Touches migration/secret/package.json? → BLOCKER
  3. Multi-file? → MUST-FIX-RISKY
  4. Reviewer used "consider"/"might"/"perhaps"? → MUST-FIX-RISKY
  5. Matches a NIT class above? → NIT
  6. Matches a MUST-FIX-SAFE class above? → MUST-FIX-SAFE
  7. Matches a BLOCKER class or recurring-blocker? → BLOCKER
  8. Otherwise → MUST-FIX-RISKY (default to surfacing)
```

---

## Telemetry-driven refinement (future)

When `forgeflow-metrics.jsonl` accumulates enough `auto-fix-applied` events, the following updates should happen:

- NIT classes with < 85% worker success rate get promoted to MUST-FIX-SAFE (tighter guardrails)
- MUST-FIX-SAFE classes with < 70% success get demoted to MUST-FIX-RISKY
- New classes that appear repeatedly in auto-fix success logs get added to NIT list
- Classes that cause frequent revert (validation gate failure) get a note: "Auto-fix attempted X times, reverted Y. Current fix rate: Y%. Surface to user if rate drops below threshold."

`/forgeflow-learnings` runs this analysis monthly.
