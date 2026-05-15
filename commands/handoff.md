---
name: handoff
description: Write a structured handoff doc so work can resume cleanly in a fresh session
argument-hint: "[topic or feature name, optional]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
---
<objective>
Capture current session state into `.claude/handoff.md` so a future session can resume cleanly after context exhaustion, /clear, or an interrupted task. This is a rolling snapshot — each run overwrites the file.
</objective>

<context>
$ARGUMENTS — Optional. A short topic or feature name that becomes the handoff title. If empty, the title is derived from the last commit subject.
</context>

## Gotchas
- **Rolling snapshot, not append.** Each run overwrites `.claude/handoff.md`. If you need to preserve a prior handoff, rename it (`mv .claude/handoff.md .claude/handoff-<topic>.md`) before running.
- **cwd matters.** Writes to `.claude/handoff.md` in the current working directory. If you're in a worktree, the handoff goes into that worktree's `.claude/` — not the main worktree's.
- **Silent section skips.** If `review-history.md` or the active plan don't exist, the corresponding sections are omitted without a warning. The absence in the handoff is the signal, not an error.
- **Next action is load-bearing.** The command forces a concrete verb-leading instruction. If `/handoff` produces a vague "Next action" like "continue work", the session state wasn't clear enough — fix the context in the running session, then re-run.
- **gitignore check only appends.** If `.gitignore` already has a pattern that covers `.claude/handoff.md`, the command doesn't add a duplicate. If gitignore is missing entirely, it creates one.

<process>

## Step 1: Gather current state

Run in parallel:
```bash
pwd
git branch --show-current
git log --oneline -20
git status -sb
gh pr view --json number,title,headRefName,state,url 2>/dev/null || echo "{}"
date +"%Y-%m-%d %H:%M"
```

## Step 2: Collect Forgeflow and validation context

Read if they exist (do NOT fail if missing):
```bash
PROJECT_NAME=$(basename "$(pwd)")
FORGEFLOW_DIR=".forgeflow/${PROJECT_NAME}"
```
- `${FORGEFLOW_DIR}/review-history.md` — latest verdict and blocker list
- `${FORGEFLOW_DIR}/current-plan.md` — active plan, if any
- `.claude/handoff.md` — prior handoff (will be overwritten)

Run validation commands if the project has them (catch stderr with `2>&1`, allow failure):
```bash
# Typecheck
pnpm typecheck 2>&1 | tail -5 || true
# Lint
pnpm lint 2>&1 | tail -5 || true
```

Capture pass/fail status for each.

## Step 3: Write handoff

Overwrite `.claude/handoff.md` with this exact structure:

```markdown
# Handoff — <YYYY-MM-DD HH:MM> — <$ARGUMENTS or last-commit-subject>

## Context
- **Working directory:** <pwd>
- **Branch:** <current-branch>
- **PR:** <#N — title — state — url> OR "none linked"
- **Last commit:** <sha-short> <subject>

## What's done this session
<bulleted summary grouped by area — draw from git log entries since the most recent base-branch divergence, plus any files edited this session that are not yet committed. Be specific, file-path-first.>

## What's pending
<bulleted list. Pull MUST-FIX and BLOCKER items from the latest Forgeflow verdict if present. Otherwise pull from TODO markers in changed files, or from the active plan's unchecked boxes.>

## Validation status
- **Typecheck:** PASS | FAIL (<n> errors) | not configured
- **Lint:** PASS | FAIL (<n> errors) | not configured
- **Tests:** <last-known state from history, or "not run this session">

## Next action
<ONE concrete, verb-leading instruction. Examples:
- "Apply the 3 blockers listed below in <file-path>, then re-run /review"
- "Resume Phase 4 of the refactor at <file-path>:<line>"
- "Write Playwright test for the new handler at <file-path>">

## Latest Forgeflow verdict
<paste from review-history.md if present. Include Arbiter's verdict and Compass's verdict with timestamps.>

## Files most recently touched
<top 10 from `git diff --name-only <base>..HEAD`, plus any uncommitted paths from `git status`>
```

## Step 4: Gitignore check

Verify `.claude/handoff.md` is in `.gitignore`. If not, append `.claude/handoff.md` to `.gitignore`. Do not commit this change automatically.

## Step 5: Report

Print exactly:
```
Handoff written to .claude/handoff.md.

Resume in a new session with: load @.claude/handoff.md
```

</process>

<success_criteria>
- [ ] `.claude/handoff.md` written with all required sections
- [ ] Branch, PR, and last commit captured from live git state (not memory)
- [ ] Pending items sourced from review verdict or plan, not invented
- [ ] Next action is concrete and verb-leading, not vague
- [ ] `.gitignore` excludes `.claude/handoff.md`
</success_criteria>
