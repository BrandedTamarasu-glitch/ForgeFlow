# Codex Project Instructions

These instructions translate the durable project rules from the Claude setup into Codex behavior for this repository.

## Command And Git Safety

- Prefix shell commands with `rtk`.
- Keep changes local unless the user explicitly asks for `git commit`, `git push`, PR creation, or GitHub CLI write actions.
- Run `git status` before staging or committing.
- Stage files by name. Do not use `git add .` or `git add -A`.
- Prefer `git revert` over destructive history rewrites. Do not run `git reset --hard` unless explicitly requested.
- Never commit `.env`, private keys, certificates, token/password/secret files, logs, coverage output, local build output, or private IDE settings.

## Worktree And Dev Server Safety

- Before starting a dev server, rebuilding a database, or running migrations, verify the current path and worktree.
- Check the target port before starting a server. If occupied, identify the owner and either stop it with user intent or choose another port.
- Do not background long-running dev servers with shell `&`; use the harness-managed background/session mechanism.
- Before reporting a service as running, verify it responds with `curl` or an equivalent request.
- Verify required environment variables and generated/compiled dependencies before starting services.

## Code Quality

- Make the smallest defensible change that solves the requested problem.
- Do not add speculative features or infrastructure.
- Prefer editing existing files over creating new abstractions.
- Add helpers only when they remove real duplication or are used at least three times.
- For TypeScript, preserve strictness. Do not introduce `any`, `// @ts-ignore`, or unjustified `eslint-disable`.
- Fix lint/type errors in files you touch.
- Keep pattern symmetry within a change: if you alter one occurrence of a recurring pattern in touched files, update the matching touched occurrences.

## Review And Validation

- Before invoking Forgeflow or asking for review, re-read the changed files.
- Run relevant typecheck, lint, and tests for non-trivial changes.
- Report validation commands and failures plainly.
- Do not claim CI passed or a reviewer approved unless that actually happened in the current artifacts.
- End implementation work with a short validation checklist when manual checks remain.

## PR And Written Output

- PR bodies should contain only substantiated claims: what changed, why, tests run, and known deferrals.
- Avoid status-report tables, fictional approvals, unverifiable production claims, and filler forgeflow output.
- Keep small-change writeups small.
- Avoid AI-ish prose in user-facing writing: no em dashes, no rhetorical contrast templates, no inflated abstractions, and no stock transition words.

## Local Session Files

- `plan.md`, `progress.md`, and `.claude/handoff.md` are local session artifacts.
- They should stay ignored and should not be committed.
- Use them for long-running work when the current state needs to survive context compaction.
