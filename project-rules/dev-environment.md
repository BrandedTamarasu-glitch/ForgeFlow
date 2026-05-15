# Dev Environment Rules (opt-in per project)

Opt-in by adding this line to a project's `CLAUDE.md` or `.claude/CLAUDE.md`:
```
@~/.claude/project-rules/dev-environment.md
```

These rules are NOT globally auto-loaded. They apply only to projects that explicitly reference this file. Most useful for projects that use git worktrees, have multi-service dev setups, or require specific env vars.

---

## Worktree Verification
Before starting ANY dev server, rebuilding a database, or running migrations, run:
```bash
pwd
git worktree list
```
Confirm the current working directory is the intended worktree. Rebuilding the wrong worktree's database has happened before. Do not skip this check.

## Port Conflict Check
Before starting a dev server, verify the target port is free:
```bash
lsof -i :3000   # or :8080, :4000, whatever the service uses
```
If the port is occupied, identify the owning process (likely another worktree's server) and decide: kill it, or start the current service on a different port. Do not just retry.

## Backgrounding Services Correctly
NEVER background a dev server with `&` inside a single Bash tool call. The shell spawning the process exits when the tool call returns, killing the backgrounded process.

Correct pattern:
```
# Use the Bash tool with run_in_background: true
```
This keeps the process attached to the harness-managed lifecycle and its logs captured.

## Required Env Before `pnpm dev`, `pnpm start`, or equivalent
Verify every required env var BEFORE starting services. Common requirements (adjust per project):
- `.env` exists at project root (or per-service if monorepo)
- `JWT_SECRET` is set (not the default placeholder)
- MSAL config is present (`MSAL_CLIENT_ID`, `MSAL_TENANT_ID` if applicable)
- SSL certs exist at the expected path
- Database connection string is reachable

If any are missing, fix them before running dev — do not start the service and debug the missing-env errors.

## Compiled Dependencies
If the project has TypeScript libraries consumed by other services (e.g., `api-clients` workspace), ensure those are built before dependent services start:
```bash
pnpm -F api-clients build
```
Missing compiled outputs surface as confusing import errors that look like code bugs.

## Monorepo Workspace Discipline
When running commands in a monorepo, prefer workspace-scoped commands:
- `pnpm -F <workspace> <cmd>` — run in one workspace only
- `pnpm -r <cmd>` — recursively in all workspaces (use sparingly)

Never run `pnpm install` or `pnpm build` at the root without intent — it affects every workspace and can mask local issues.

## Before Reporting a Service as "Running"
Verify the service actually responds:
```bash
curl -sf http://localhost:<port>/health || curl -sf http://localhost:<port>/
```
"Process started" and "service is serving requests" are not the same thing.
