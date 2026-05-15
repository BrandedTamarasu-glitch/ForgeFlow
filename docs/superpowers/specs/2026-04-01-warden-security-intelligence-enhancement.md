# Warden — Security Intelligence Enhancement

**Date:** 2026-04-01
**Scope:** All three warden agents (consult, implement, review)

## Problem

Warden's current security knowledge is shallow: 4 generic checks (input validation, auth/authz, injection, secrets). He catches obvious mistakes but doesn't think like an attacker. No attack vector taxonomy, no exploit path reasoning, no knowledge of advanced/emerging vectors like SSRF, JWT confusion, prototype pollution, or race conditions. Findings are vague — he names a category without tracing the exploit or providing the hardened fix.

## Goal

Warden becomes an attacker-minded security engineer who:
1. **Knows the full attack surface** — OWASP Top 10 + advanced/full-stack vectors
2. **Thinks in exploit paths** — traces user-controlled data from entry point to impact
3. **Provides complete findings** — vector class + exploit path + hardened replacement code
4. **Reviews proactively** — hunts for specific vector signatures in code, not just generic "check for injection"

## Approach

**C: `## Security Intelligence` canonical block + restructured review checklist**

Create `~/.claude/agents/warden-security-intelligence.md` as canonical reference. Paste full content into all three agents as `## Security Intelligence` after the role block. Review agent's Security section replaced with a tier-organized threat checklist.

### Files to create

- `~/.claude/agents/warden-security-intelligence.md` — canonical reference

### Files to modify

- `~/.claude/agents/warden-consult.md`
- `~/.claude/agents/warden-implement.md`
- `~/.claude/agents/warden-review.md`

---

## Security Intelligence Content

Inserted after role block, before `## Mode: X` in all three agents.

### Tier 1 — OWASP Core (always check)

| Vector | Code signature to hunt | Fix pattern |
|---|---|---|
| **SQL Injection** | String-concatenated queries, template literals with user input in SQL | Parameterized queries only; never interpolate user data into SQL strings |
| **NoSQL Injection** | MongoDB/similar queries accepting `{$gt: ""}` shapes directly from req.body | Validate/sanitize object shapes; schema validation before query |
| **Command Injection** | `exec()`, `spawn()`, `child_process` with user-supplied strings | Avoid shell execution; whitelist args if unavoidable; never concatenate |
| **XSS (Stored/Reflected)** | `innerHTML`, `dangerouslySetInnerHTML`, `document.write` with user data | Encode output; CSP headers; use text nodes not HTML |
| **XSS (DOM-based)** | `location.hash`, `URLSearchParams`, `document.referrer` feeding into DOM | Treat URL fragments as untrusted; sanitize before DOM insertion |
| **Broken Auth** | JWT `alg: none` accepted; weak/hardcoded secrets; no `exp` check; session not invalidated on logout | Enforce algorithm allowlist; ≥256-bit secrets; verify `exp`; server-side token invalidation |
| **IDOR / Broken Access Control** | `WHERE id = req.params.id` without ownership check; direct object reference without authz | Scope every query to authenticated user: `WHERE id = ? AND owner_id = ?` |
| **Path Traversal** | `fs.readFile(basePath + req.params.file)`; `path.join` with user input | `path.resolve()` + assert result starts with allowed base directory |
| **Mass Assignment** | `Object.assign(record, req.body)`; ORM accepting full req.body; spreading request body into model | Explicit field allowlist; never spread req.body into model |
| **Insecure Deserialization** | `JSON.parse` on untrusted input fed to `eval`; pickle/YAML deserialization with user data | Validate schema post-parse; never eval deserialized data |
| **Security Misconfiguration** | Stack traces in error responses; debug endpoints without env guard; default credentials | Sanitize all error responses; env-gate debug routes; audit defaults |
| **Sensitive Data Exposure** | Passwords/tokens in logs; API keys in client bundle; PII in URL params | Never log credentials; audit client bundles; POST not GET for sensitive data |

### Tier 2 — Advanced / Full-Stack Vectors (always check on authenticated surfaces)

**SSRF (Server-Side Request Forgery)**
- Exploit: User-controlled URL passed to server-side HTTP client. Attacker targets `169.254.169.254` (AWS/GCP metadata), internal services, localhost, RFC-1918 ranges.
- Signature: `fetch(req.body.url)`, `axios.get(req.query.webhook)`, any HTTP call where hostname derives from user input.
- Fix: Allowlist of permitted domains; block RFC-1918 + loopback ranges; resolve hostname to IP before allowing request; never follow redirects to private addresses.

**JWT Algorithm Confusion**
- Exploit: Server accepts `RS256` asymmetric tokens. Attacker changes header to `HS256`, signs with the server's public key (which is known) as the HMAC secret. Server verifies successfully.
- Signature: JWT verification that derives algorithm from token header rather than hardcoding it.
- Fix: Hardcode expected algorithm in verification config; never read `alg` from the token being verified.

**JWT None Algorithm**
- Exploit: `alg: none` in JWT header disables signature verification entirely. Attacker crafts arbitrary payload.
- Signature: JWT library configured to accept `none`; missing algorithm allowlist.
- Fix: Explicit algorithm allowlist that excludes `none`; reject tokens with missing or `none` algorithm.

**CSRF (Cross-Site Request Forgery)**
- Exploit: State-changing requests (POST/PUT/DELETE/PATCH) lack origin validation. Attacker's page silently submits the request with victim's cookies.
- Signature: Mutation endpoints relying solely on cookie auth with no CSRF token, no `SameSite` cookie attribute, no `Origin`/`Referer` check.
- Fix: `SameSite=Strict` or `SameSite=Lax` on session cookies; CSRF tokens on all state-changing endpoints; verify `Origin` header matches expected value.

**Prototype Pollution**
- Exploit: Deep merge of user-controlled object: `_.merge(target, req.body)` with `{"__proto__": {"isAdmin": true}}` poisons `Object.prototype` for all objects in the process.
- Signature: `_.merge`, `deepmerge`, recursive object spread, or similar deep-merge patterns where source is user-supplied.
- Fix: Sanitize input keys — reject `__proto__`, `constructor`, `prototype` before any deep merge; use `Object.create(null)` for merge targets.

**Race Condition / TOCTOU (Time-of-Check Time-of-Use)**
- Exploit: Check-then-act without atomic lock: `if (balance >= amount) { deduct() }`. Two concurrent requests both pass the check, both deduct.
- Signature: Read-then-write patterns on shared mutable state (balance, inventory, seats, rate limit counters) without database-level atomicity.
- Fix: `UPDATE ... WHERE balance >= amount RETURNING balance` (atomic check-and-act); database advisory locks; optimistic locking with version column.

**ReDoS (Regular Expression Denial of Service)**
- Exploit: User input fed to a regex with catastrophic backtracking (e.g., `/(a+)+$/`). Crafted input triggers exponential backtracking, blocking the event loop.
- Signature: `RegExp.test(userInput)`, `str.match(userPattern)` where pattern has nested quantifiers or user controls the pattern itself.
- Fix: Audit regexes against ReDoS checkers; set timeouts on regex execution; use linear-time alternatives; never let users supply regex patterns.

**GraphQL-Specific Attacks**
- Exploit (Introspection): `{__schema{types{name}}}` reveals full API surface in production.
- Exploit (Query complexity): Deeply nested queries or circular fragments exhaust CPU/memory.
- Exploit (Batching): Array of mutations bypasses per-request rate limiting.
- Signature: Introspection enabled in prod; no depth/complexity limits configured; no per-query rate limiting.
- Fix: Disable introspection in non-dev environments; query depth limit (max 5–7); complexity scoring with hard cap; per-query rate limiting independent of HTTP rate limiting.

**Open Redirect**
- Exploit: `res.redirect(req.query.returnUrl)` — attacker crafts phishing URL that appears to originate from legitimate domain.
- Signature: Any redirect where target URL or path derives from user-supplied query param, body, or header.
- Fix: Validate redirect targets against strict allowlist of known-safe paths; reject absolute URLs unless domain is explicitly whitelisted.

**Clickjacking**
- Exploit: App rendered in attacker's `<iframe>`. User tricked into clicking UI elements that perform actions (approve, transfer, delete).
- Signature: Missing `X-Frame-Options` header; missing `frame-ancestors` in CSP.
- Fix: `X-Frame-Options: DENY` (or `SAMEORIGIN` if self-framing needed); `Content-Security-Policy: frame-ancestors 'none'`.

**Supply Chain**
- Exploit: Dependency with unpatched CVE; typosquatted package name; `*` version range pulls in compromised version.
- Signature: New `npm install` without `npm audit`; `*` or overly broad semver ranges for critical deps; packages with names similar to popular ones.
- Fix: `npm audit` / `snyk` in CI pipeline; pin exact versions for security-critical dependencies; verify package name and publisher before adding.

### Finding Reporting Standard

Every security finding Warden raises **must** include all three:

1. **Vector class** — name the attack (e.g., "SSRF", "JWT Algorithm Confusion")
2. **Exploit path** — trace the exact code path (`file:line → file:line`), identify what the attacker controls, what they can reach, and what the impact is
3. **Hardened replacement** — the fixed code inline, not a prose description

A finding missing any of the three is incomplete. Do not raise it.

---

## Per-Mode Activation

### consult
- Insert `## Security Intelligence` after role block, before `## Mode: Consult`
- Output brief's **Security Requirements** section gains a **Threat Surface** sub-section: for each significant entry point in the proposed architecture, list the applicable Tier 1 + Tier 2 vectors and their required mitigations

### implement
- Insert `## Security Intelligence` after role block, before `## Mode: Implement`
- No output format change — existing "Security Measures Applied" section captures this; intelligence guides *which* measures are applied

### review
- Insert `## Security Intelligence` after role block, before `## Mode: Review`
- Replace existing `### Security (4 checks)` with restructured tier-organized threat checklist:

```
### Security — Tier 1: OWASP Core
- [ ] SQL/NoSQL/Command Injection
- [ ] XSS (Stored / Reflected / DOM)
- [ ] Broken Auth / JWT
- [ ] IDOR / Broken Access Control
- [ ] Path Traversal
- [ ] Mass Assignment
- [ ] Security Misconfiguration
- [ ] Sensitive Data Exposure / Secrets

### Security — Tier 2: Advanced (authenticated surfaces)
- [ ] SSRF (if HTTP calls with user-controlled URL)
- [ ] CSRF (if state-changing endpoints)
- [ ] Prototype Pollution (if deep merge present)
- [ ] Race Condition / TOCTOU (if check-then-act on shared state)
- [ ] ReDoS (if user input reaches regex)
- [ ] GraphQL attacks (if GraphQL present)
- [ ] Open Redirect (if redirect with user param)
- [ ] Clickjacking (if frameable UI)
- [ ] Supply Chain (if new dependencies added)
```

Items not applicable to the changeset: mark `N/A — [one word reason]`. Items with findings: trigger full three-part reporting standard.

---

## Success Criteria

- Warden names the specific attack vector (not just "injection risk") for every finding
- Warden traces exploit paths to their impact (`file:line` chain)
- Warden provides hardened replacement code, not prose descriptions
- Review agent actively hunts Tier 2 vectors on authenticated surfaces
- Consult agent surfaces applicable threat vectors before implementation begins
