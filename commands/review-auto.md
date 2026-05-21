---
name: review-auto
description: Run /review, auto-apply safe fixes for trivial findings, re-review, and surface remaining items. Up to 2 iterations.
argument-hint: "[same as /review, plus --max-iterations N (default 2)]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
---
<objective>
Compress the Forgeflow's `/review` → fix → re-review loop. Run `/review`, classify findings by risk AND by source reviewer, dispatch the Forgeflow team's own implement agents to apply low-risk fixes under strict validation gates, re-run the Forgeflow team, and surface everything that still needs human judgment. Never silently ship ambiguous changes.

This is the closed-loop enhancement proposed in the insights report. It is deliberately conservative — it only automates fixes where the cost of getting it wrong is low and recovery is trivial.

**Forgeflow integration:** This command is a first-class participant in the Forgeflow team lifecycle (`/discuss` → `/research` → `/plan` → `/consult` → `/implement` → `/review` → `/review-auto` → `/ship`). It reuses Forgeflow conventions:
- Implement agents (smith-implement, warden-implement, lumen-implement, arbiter-implement) are the workers — not generic anonymous subagents
- Findings are attributed to the source reviewer (Smith, Warden, Lumen, Atlas) so the matching implement agent applies the fix
- Each iteration is appended to `.forgeflow/<project>/review-history.md` as a round-N entry
- Atlas's persistent agent-notes receive the auto-fix patterns so recurring NIT classes get surfaced as plan-time warnings next cycle
- The final re-review uses the normal `/review` flow; `/ship`'s review gate accepts the post-auto-fix verdict because the gate reads `review-history.md` directly
</objective>

<context>
$ARGUMENTS — optional. Same as `/review` (file paths, git ref, `--pr <N>`, `--skip-preflight`) plus:
- `--max-iterations <N>` — cap the fix-review loop (default: 2, max: 3)
- `--dry-run` — classify findings and report what would be auto-fixed, but do not apply changes
- `--ci` — headless CI mode. Auto-enabled when `CLAUDE_CODE_HEADLESS=1` is set. Skips the initial `/review` call when `--from-verdict-json` is supplied; commits and pushes fixes (including `chore(auto-fix): apply Forgeflow items (round N)` subject); emits a post-fix verdict JSON block per `docs/forgeflow-json-schema.md` so the wrapper can post the updated verdict
- `--from-verdict-json <path>` — CI mode only. Accepts a PATH to a JSON file containing a pre-computed verdict (from an earlier `/review --ci` run) and starts at classification (Step 2) instead of running a fresh `/review`. This is how the PR workflow avoids paying for two reviews when the first run already produced findings. The JSON is read from the file, not passed inline — shell arg length limits make inline JSON unreliable for large findings arrays.
</context>

## Gotchas
- **Warden-flagged items are always surfaced, never auto-applied.** Even if a Warden finding is labeled MUST-FIX-SAFE by tier rules, the source-reviewer check forces it to MUST-FIX-RISKY. Do not remove that safeguard — it exists because "security-adjacent safe" is an oxymoron.
- **Separate commit per iteration.** Do not rebase or squash between iterations until the loop completes. Each `chore(auto-fix): apply Forgeflow items (round N)` commit is referenced in `review-history.md` — rewriting the commit invalidates the audit trail.
- **Iteration 2+ does not re-prompt unless new items appear.** This is intentional — the first-iteration approval covers NITs that recur in iteration 2. If you want to stop mid-loop, interrupt via Ctrl+C; partial work remains committed, review-history shows the cut-off round.
- **Revert mechanism is path-scoped.** Track the exact files touched by workers. Revert only those paths with `git checkout -- <file>` and remove only new untracked files detected in Step 5.1 using path-safe handling. Never run `git checkout -- .`.
- **Agent pre-check substitutions persist only for the run.** If you pick replacements at Step 1.5, they apply to this invocation only. The next `/review-auto` re-runs the check from scratch. Install the standard agents via `/update-forgeflow` for a permanent fix.
- **Dry-run does not call `/review`.** It only runs the classifier on the existing review output. If you have no prior review in history, `--dry-run` after a fresh `/review` invocation requires the full flow first.

<process>

## Step 0: CI mode detection

If `$ARGUMENTS` contains `--ci` OR the env var `CLAUDE_CODE_HEADLESS=1` is set, set `CI_MODE=true`. Otherwise false.

When `CI_MODE=true`:
- Suppress all user-facing markdown narrative. Internal step outputs accumulate into memory for the final Step N JSON emission.
- Skip all `AskUserQuestion` prompts; use conservative defaults (accept the proposed fix set only if every item is NIT or MUST-FIX-SAFE non-security; abort the auto-fix pass otherwise).
- Push commits back to the PR branch on each completed iteration. Commit subject format: `chore(auto-fix): apply Forgeflow items (round N)`.
- At the end, emit a single `<forgeflow-verdict-json>...</forgeflow-verdict-json>` block containing the POST-FIX verdict so the wrapper can update the PR comment.

## Step 1: Initial review (skipped when --from-verdict-json is supplied)

If `$ARGUMENTS` contains `--from-verdict-json <path>` (CI mode only): read the JSON file at that path, parse per `docs/forgeflow-json-schema.md` (reject on `schema_version` mismatch), hydrate into the same in-memory structure the rest of the command expects, and skip to Step 2.

Otherwise: invoke `/review $ARGUMENTS` — strip flags that `/review` does not accept (`--max-iterations`, `--dry-run`, `--from-verdict-json <path>`) before passing through. KEEP `--ci` when set — `/review` recognizes it since V5.0 Phase 2 and must run in CI mode here too so its verdict JSON can be consumed by Step 2 classification and Step 7.5 final emission.

Record the verdict. If the verdict is APPROVE + CONFIRM, exit with:
`"Review passed on first pass. No auto-fix needed."` (or, in CI mode, emit the unchanged verdict JSON with `auto_fix_applied: false` and exit 0).

## Step 1.5: Verify Forgeflow implement agents (pre-flight)

Before classification, verify that all expected Forgeflow implement agents are installed. If any are missing, prompt the user to pick replacements from installed agents.

### 1.5a. Detect installed agents

```bash
AGENT_DIR="$HOME/.claude/agents"
LOCAL_AGENT_DIR="$(pwd)/.claude/agents"

# Expected Forgeflow implement agents
EXPECTED=(smith-implement warden-implement lumen-implement arbiter-implement)

# Missing list
MISSING=()
for agent in "${EXPECTED[@]}"; do
  if [ ! -f "$AGENT_DIR/$agent.md" ] && [ ! -f "$LOCAL_AGENT_DIR/$agent.md" ]; then
    MISSING+=("$agent")
  fi
done

# Full installed agent list (global + local, deduped)
INSTALLED=$(
  { ls "$AGENT_DIR"/*.md 2>/dev/null; ls "$LOCAL_AGENT_DIR"/*.md 2>/dev/null; } \
  | xargs -I{} basename {} .md \
  | sort -u
)
```

### 1.5b. If nothing missing, continue

If `MISSING` is empty, proceed directly to Step 2.

### 1.5c. If agents missing, prompt for replacements

For EACH missing agent, use `AskUserQuestion` with:
- **Question:** `"{missing-agent} is not installed. Pick a replacement from installed agents, or 'skip' to surface all findings tagged to this agent as MUST-FIX-RISKY."`
- **Options:** the full list of installed agents from 1.5a + a final `"skip"` option + a `"cancel"` option

Store the response in an agent-substitution map:
```
AGENT_MAP[smith-implement]=<user-chosen-replacement-or-skip>
AGENT_MAP[warden-implement]=<...>
...
```

If the user picks `"cancel"` at any prompt, exit:
`"/review-auto cancelled: required Forgeflow agents missing and user declined substitution."`

### 1.5d. Confirm mapping

Before proceeding, show the user the full substitution summary:
```
Agent substitutions for this run:
- smith-implement → <chosen-agent or SKIP>
- warden-implement            → <chosen-agent or SKIP>
- lumen-implement  → <chosen-agent or SKIP>
- arbiter-implement            → <chosen-agent or SKIP>
```

### 1.5e. Apply the map during dispatch

When Step 4 dispatches workers, use AGENT_MAP to resolve the target agent name:
- If `AGENT_MAP[<expected>]` is a real agent name, dispatch via that agent
- If `AGENT_MAP[<expected>]` is `"skip"`, do NOT dispatch — instead reclassify all findings tagged to that source reviewer as MUST-FIX-RISKY for this round and surface them to the user
- If `AGENT_MAP` has no entry (agent was installed), use the original expected name

Record the substitutions in the review-history round entry (Step 6.5) so the audit trail shows the run used non-standard agents.

## Step 2: Classify findings (tier + source reviewer + implement agent)

If verdict is REVISE or BLOCK, parse Arbiter's consolidated verdict and the individual agent outputs (Smith, Warden, Lumen, Atlas) into a list of findings. For each finding, record:
- **Tier** (NIT / MUST-FIX-SAFE / MUST-FIX-RISKY / BLOCKER)
- **Source reviewer** (fc / warden / lumen / atlas / arbiter-synthesized)
- **Target implement agent** (the Forgeflow team member best suited to apply the fix)

**Tier classification rules:**

**NIT (auto-fixable):**
- Formatting only (prettier, lint --fix territory)
- Missing return statements in void-returning handlers
- Unused imports / unused variables
- Missing `const` / `let` where appropriate
- Single-file changes with no behavioral implication

**MUST-FIX-SAFE (auto-fixable, tighter constraints):**
- Missing null/undefined guards on known-nullable values
- Missing `await` on promises where the return type is already correctly typed
- Single-file, no API surface change, no test change required

**MUST-FIX-RISKY / BLOCKER (always surface to user):**
- Anything touching auth, permissions, migrations, or security boundaries
- Behavioral changes
- Multi-file changes
- Anything flagged by `warden-review` as security-adjacent
- Anything where the reviewer expressed uncertainty ("consider", "might", "perhaps")
- Type-signature changes that affect callers
- Database schema changes

If uncertain, classify as MUST-FIX-RISKY. Default to surfacing, not automating.

**Source-reviewer → implement-agent mapping:**

| Source reviewer | Target implement agent | Rationale |
|-----------------|------------------------|-----------|
| `smith-review` | `smith-implement` | Code quality, naming, design, DRY/SOLID |
| `warden-review` (NIT only) | `warden-implement` | Security-adjacent NIT like unused imports in auth modules |
| `lumen-review` | `lumen-implement` | UX/frontend surface and service connectivity |
| `atlas-review` | `smith-implement` | Atlas does not implement; Smith handles process/doc-level code NITs |
| `arbiter-review` (synthesized, cross-cutting) | `arbiter-implement` | Architecture-spanning fixes |

Do not route MUST-FIX-SAFE items flagged by Warden to auto-apply — force those to MUST-FIX-RISKY regardless of safety heuristics. Security-adjacent "safe" is an oxymoron in this flow.

Output a classification table:
```
| # | Finding | Tier | Source | Target agent | File(s) | Auto-fix? |
|---|---------|------|--------|--------------|---------|-----------|
| 1 | Missing null check on userId | MUST-FIX-SAFE | fc | smith-implement | src/auth.ts | yes |
| 2 | Migration adds NOT NULL without backfill | BLOCKER | fc | — | migrations/0042_... | no |
| 3 | Unused import `fs` | NIT | fc | smith-implement | src/utils.ts | yes |
| 4 | Button lacks aria-label | NIT | lumen | lumen-implement | src/components/Btn.tsx | yes |
| 5 | Token comparison uses === on raw string | MUST-FIX-RISKY | warden | — | src/auth/session.ts | no |
```

## Step 3: User gate

Display the classification table.

If `--dry-run` was passed: stop here with `"Dry run complete. 0 fixes applied."`

**CI mode (CI_MODE=true):**
Skip both iteration branches below. Apply the conservative default:
- If the auto-fixable list (NIT + MUST-FIX-SAFE) is non-empty AND NO finding has an UNSAFE class tag (`sql-injection`, `auth`, `secret`, `token`, `jwt`, `permission`, `rbac`, `crypto`, `password`, `csrf`, `xss`, `ssrf`) — proceed to Step 4 automatically. This matches the wrapper's pre-gate in `scripts/forgeflow-pr-review.sh`.
- If EVERY finding is MUST-FIX-RISKY or BLOCKER, abort the auto-fix pass. Emit the post-fix JSON with `auto_fix_applied: false` and a reason. The wrapper's review-and-fix branch handles this as "no safe fixes found, surfaced only."
- Never prompt; never block on iteration-2 re-approval. Treat every iteration as pre-approved within the whitelist.

**Iteration 1 (always prompt):**
Use AskUserQuestion to confirm:
```
Auto-apply <n> fix(es) to <m> file(s) now? Only NIT and MUST-FIX-SAFE items will be auto-applied.

MUST-FIX-RISKY and BLOCKER items (<k>) will be surfaced for you to handle.
```

If the user declines, exit and show only the MUST-FIX-RISKY/BLOCKER items.

**Iteration 2+ (conditional prompt):**
Compare this iteration's auto-fixable list to iteration 1's. If ANY of the following is true, re-prompt:
- A new MUST-FIX-SAFE item appears that was not in iteration 1
- A file not touched in iteration 1 is about to be auto-modified
- A new MUST-FIX-RISKY or BLOCKER item appears (these will be surfaced, not applied, but the user should see the updated table)

If none of the above, proceed silently — NIT-only and already-approved items continue without re-prompting. The first-iteration approval covers these.

Track the iteration-1 approval state so iteration 2+ knows what was already sanctioned.

## Step 4: Apply auto-fixes via Forgeflow implement agents

Before dispatching, snapshot the untracked file list (for scope-violation detection on revert):
```bash
git status --porcelain=v1 -z | python3 -c 'import sys; data=sys.stdin.buffer.read().split(b"\0"); sys.stdout.buffer.write(b"\0".join(item[3:] for item in data if item.startswith(b"?? ")) + b"\0")' > /tmp/auto-fix-untracked-before.z
```

### 4a. Pre-load context (Forgeflow convention)

Read each auto-fixable finding's target file once into orchestrator context. Assemble the `<injected-context>` block following the same pattern as `/review` Step 3.5:

```xml
<injected-context>
<context-meta command="/review-auto" agent="{implement-agent-name}" round="{N}" />

IMPORTANT: Target file contents are pre-loaded below. Do NOT call Read on these files — they are already in your context. Touch ONLY the file specified in your task.

<shared-files>
<file path="{target-file-path}">
{file contents verbatim}
</file>
</shared-files>

<agent-files></agent-files>
</injected-context>
```

### 4b. Dispatch via Agent tool using the mapped Forgeflow implement agent

For each auto-fixable finding, dispatch via `Agent` with `subagent_type=<target agent>` from the mapping table in Step 2. Workers run in parallel.

Worker prompt template:
```
Context is pre-loaded in <injected-context> below. Do not re-read files already present.

{injected-context block with agent="{target-agent}", round="{N}"}

You are applying a single specific fix identified by the Forgeflow. You are the implement-mode counterpart of the reviewer who flagged this item (source: {source-reviewer}). Apply the fix within your domain discipline — do not extend scope into other agents' territory.

Constraints (hard):
1. Make ONLY the minimum change needed to resolve this specific item. Do not refactor. Do not touch unrelated code. Do not add tests. Do not create new files.
2. Change ONE file only: {target-file}
3. If resolving this finding requires touching any other file, abort and return exactly: "REQUIRES MULTI-FILE CHANGE"
4. If you cannot locate the section or line referenced in the finding, abort and return exactly: "EDIT TARGET NOT FOUND"
5. If you hit an unexpected error, abort and return exactly: "UNEXPECTED ERROR: <one-line description>"
6. On success, return exactly: "SUCCESS: <one-line summary of the change>"

<file-scope>
Edit ONLY: {target-file}
</file-scope>

Finding to fix (round {N}, source: {source-reviewer}):
{finding description verbatim from Arbiter's consolidated verdict}

Arbiter's severity: {tier}
Atlas persistent context: .forgeflow/{project-name}/agent-notes/
```

### 4c. Collect results

For any worker that returned anything other than `SUCCESS:`:
- Reclassify that finding as MUST-FIX-RISKY for this round
- Do not count it as auto-applied
- Log the worker's non-SUCCESS return string for the surface-to-user summary
- Continue — other workers may still have succeeded

For every worker that returned `SUCCESS:`, record:
- The target agent that applied the fix
- The source reviewer that flagged it
- The one-line summary (for the commit message and review-history round entry)

## Step 5: Validation gate

After all workers return, before any commit:

```bash
# 5.1 — Scope check: new untracked files are a violation
git status --porcelain=v1 -z > /tmp/auto-fix-status-after.z
python3 - "$PWD" /tmp/auto-fix-untracked-before.z /tmp/auto-fix-status-after.z <<'PY'
import os
import sys

root, before_path, status_path = sys.argv[1:4]

def read_before(path):
    if not os.path.exists(path):
        return set()
    data = open(path, "rb").read()
    return {item.decode("utf-8", "surrogateescape") for item in data.split(b"\0") if item}

def read_after(path):
    data = open(path, "rb").read()
    items = [item.decode("utf-8", "surrogateescape") for item in data.split(b"\0") if item]
    return {item[3:] for item in items if item.startswith("?? ")}

created = sorted(read_after(status_path) - read_before(before_path))
if created:
    print("Worker created new files (scope violation):")
    for rel_path in created:
        print(f"  - {rel_path}")
        os.unlink(os.path.join(root, rel_path))
    sys.exit(1)
PY
if [ "$?" -ne 0 ]; then
  # Also revert only worker-touched tracked files.
  git checkout -- <worker-touched-files>
  exit 1
fi

# 5.2 — File count limit
CHANGED=$(git diff --name-only | wc -l)
if [ "$CHANGED" -gt 10 ]; then
  echo "Auto-fix touched $CHANGED files. Limit is 10. Reverting."
  git checkout -- <worker-touched-files>
  exit 1
fi

# 5.3 — Typecheck with 5-minute safety timeout
timeout 300 pnpm typecheck 2>&1 | tee /tmp/auto-fix-typecheck.log
TYPECHECK_EXIT=${PIPESTATUS[0]}
# Exit 124 means timeout triggered — treat as failure
if [ "$TYPECHECK_EXIT" -eq 124 ]; then
  echo "Typecheck exceeded 5-minute timeout. Reverting."
fi

# 5.4 — Lint with 2-minute safety timeout
timeout 120 pnpm lint 2>&1 | tee /tmp/auto-fix-lint.log
LINT_EXIT=${PIPESTATUS[0]}
if [ "$LINT_EXIT" -eq 124 ]; then
  echo "Lint exceeded 2-minute timeout. Reverting."
fi
```

If typecheck or lint failed (including timeout):
- Display the failing output (first 20 lines)
- Revert ALL auto-fix changes: `git checkout -- <file>` for each file touched, plus `rm -f` any new untracked files detected in 5.1
- Surface the original findings (un-fixed) plus a note that auto-fix was attempted and reverted, with the failure reason (typecheck fail / lint fail / timeout / scope violation)
- Exit

Never proceed past a failing validation gate.

## Step 6: Commit auto-fix batch

If validation passed, commit the auto-fix batch as a dedicated commit (not mixed with user work):

```bash
PROJECT_NAME=$(basename "$(pwd)")
git add <only the files touched by workers>
git commit -m "chore(auto-fix): apply Forgeflow items (round {N})

Items applied:
- [fc] Added null guard on userId at line 42 (src/auth.ts)
- [lumen] Added aria-label to primary button (src/components/Btn.tsx)
- ...

Auto-applied via /review-auto. Prior verdict: <REVISE|BLOCK>. Re-review follows.
Forgeflow context: .forgeflow/${PROJECT_NAME}/review-history.md"
```

Never force-push. Never amend. Create a new commit so the audit trail is clean.

## Step 6.2: Push to remote (CI mode only)

When `CI_MODE=true`, push the commit back to the PR branch so subsequent CI stages and re-triggers see the fix:

```bash
# The CI wrapper (.github/workflows/forgeflow.yml) configures git identity
# and checks out the PR BRANCH (ref, not sha) with fetch-depth:0. Prefer the
# GitHub-provided branch name env var — falls back to `git branch --show-current`
# for non-GitHub CI hosts.
PR_BRANCH="${GITHUB_HEAD_REF:-$(git branch --show-current)}"
if [ -z "$PR_BRANCH" ]; then
  log "push aborted: could not resolve PR branch (detached HEAD with no GITHUB_HEAD_REF)"
  # Emit push_error in Step 7.5 metadata; exit after Step 7.5 emission.
  PUSH_ERROR="detached-head-no-branch"
else
  git push origin HEAD:"$PR_BRANCH"
fi
```

If the push fails (stale branch after a concurrent human commit, or permissions issue in a fork PR), capture the error, emit the post-fix verdict with `metadata.push_error: "<first-line of git error>"`, and return exit code 2. The wrapper treats push failures as ABORTED and posts a follow-up comment noting the fix was computed but not pushed — the user can apply the diff manually.

In interactive mode (CI_MODE=false), never push. The user decides when to push.

## Step 6.5: Log round to review-history.md (Forgeflow integration)

Append a round entry to `.forgeflow/<project>/review-history.md`:

```markdown
## <YYYY-MM-DD HH:MM> — /review-auto round {N}
**Trigger:** /review-auto invoked after <prior-verdict>
**Items auto-applied:** {count} (NIT: X, MUST-FIX-SAFE: Y)
**Items surfaced:** {count} MUST-FIX-RISKY, {count} BLOCKER
**Workers dispatched:** {comma-separated implement agent list}
**Agent substitutions (if any):** {expected → actual; "none" if all standard Forgeflow agents present}
**Worker outcomes:**
- smith-implement: {n} SUCCESS, {m} MULTI-FILE, {k} NOT-FOUND
- warden-implement: {n} SUCCESS, ...
- lumen-implement: ...
**Commit:** {sha} chore(auto-fix): apply Forgeflow items (round {N})
**Validation:** typecheck PASS, lint PASS, files-changed {n}, untracked-delta 0
**Next:** re-running /review (iteration {N+1} of {max})
```

This ties the auto-fix run into the same history `/ship` reads at its review gate. The gate accepts post-auto-fix verdicts without flagging them as stale.

## Step 6.6: Persist patterns to Atlas's agent-notes (Forgeflow integration)

Append to `.forgeflow/<project>/agent-notes/atlas-<user>.md` where `<user>` = `team_members[0].username` from `.forgeflow/<project>/config.json`, defaulting to `local` if config absent (or `learnings.jsonl` if the project uses structured logs):

```markdown
### Auto-fix pattern (round {N}, {date})
Classes of NITs that surfaced this round:
- {NIT class}: {count} occurrence(s) across {file count} file(s)
- {MUST-FIX-SAFE class}: {count}

Recurring patterns flagged (appear in 2+ rounds this cycle):
- {pattern} — suggest adding to plan-time warnings for next cycle
```

Next time Atlas participates in `/plan` or `/consult`, these patterns appear in persistent context, letting the Forgeflow team preempt them before code is written.

After writing agent notes, refresh and check project learnings so auto-fix patterns can flow into latest insights:

```bash
HELPER_DIR="scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/show-project-learnings.js" ] && [ -f "$HOME/.claude/forgeflow/scripts/forgeflow/show-project-learnings.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ -f "${HELPER_DIR}/show-project-learnings.js" ]; then
  node "${HELPER_DIR}/show-project-learnings.js" --project-dir ".forgeflow/${PROJECT_NAME}" --check --json
fi
```

## Step 7: Re-review

Invoke `/review $ARGUMENTS` again WITH the same argument-stripping rules as Step 1: strip `--max-iterations`, `--dry-run`, `--from-verdict-json <path>` before passing through. KEEP `--ci` when set — the re-review must run in CI mode so it emits a JSON verdict the wrapper and Step 7.5 can consume. `--from-verdict-json` must never appear on a re-review; re-reviews always execute a fresh classification.

Parse the new verdict. When `CI_MODE=true`, extract the `<forgeflow-verdict-json>...</forgeflow-verdict-json>` block from `/review`'s stdout using the same Python regex extractor the wrapper uses (see `scripts/forgeflow-pr-review.sh`). Validate `schema_version: "1"`. Preserve this parsed verdict object as the basis for Step 7.5's final emission — do not re-derive the verdict from prose.

**If APPROVE + CONFIRM:**
Append the final post-fix verdict from the re-review to `.forgeflow/<project>/review-history.md` if `/review` did not already write it. The entry must include the final `APPROVE + CONFIRM`, branch, HEAD, iteration count, and auto-fix commit SHA so `/ship` consumes the approved post-fix state rather than the earlier round entry.

Report:
```
## Auto-fix loop: SUCCESS

Applied <n> fix(es) in 1 iteration.
Final verdict: APPROVE + CONFIRM.

Commit: <sha> chore(auto-fix): ...
```

**If still REVISE/BLOCK AND iterations remaining (< max-iterations):**
Return to Step 2 with the new verdict. Cap enforced.

**If still REVISE/BLOCK AND iteration cap reached:**
Report:
```
## Auto-fix loop: INCOMPLETE

Applied <n> fix(es) across <k> iteration(s). Verdict still <REVISE|BLOCK>.

Remaining items (surfaced for human judgment):
<filtered list of MUST-FIX-RISKY and BLOCKER items>

Next action: review the remaining items, apply the fixes manually, then re-run /review.
```

## Step 7.5: CI JSON emission (CI_MODE only)

When `CI_MODE=true`, emit a post-fix JSON block per `docs/forgeflow-json-schema.md` v1 so the wrapper (`scripts/forgeflow-pr-review.sh`) can post the updated PR comment.

### Data sources for the emitted object

- `verdict` / `summary` / `arbiter` / `compass` / `findings` / `files_reviewed` / `chunking` — take from the re-review's verdict JSON parsed in Step 7 when fixes were applied. When no fixes were applied (aborted-unsafe path or dry-run), carry forward the INPUT verdict JSON (either from `--from-verdict-json <path>` or from the Step 1 initial review).
- `routing_mode` / `routing_override` — mirror whatever the most recent `/review --ci` run reported.
- `auto_fix_*` keys (documented below) — computed locally by `/review-auto` from Steps 4-6 execution records.
- `metadata.duration_seconds` — sum of initial review + each fix round + re-review durations.
- `metadata.cost_estimate_usd` — sum of all `/review --ci` cost estimates this invocation made.
- `metadata.push_error` — populated only if `auto_fix_status == "push-failed"` from Step 6.2.

### Auto-fix augmentation

```json
{
  ...standard schema fields from /review Step 7.5...
  "auto_fix_applied": true,
  "auto_fix_rounds": 2,
  "auto_fix_items_applied": 7,
  "auto_fix_items_skipped": 3,
  "auto_fix_commits": ["abc1234", "def5678"],
  "auto_fix_status": "success | cap-reached | aborted-unsafe | push-failed",
  "metadata": {
    ...standard metadata...
    "push_error": null
  }
}
```

The `verdict`, `arbiter`, `compass`, `findings`, and `files_reviewed` fields reflect the POST-FIX state (Step 7's re-review). If the auto-fix aborted before any changes (every finding was MUST-FIX-RISKY / BLOCKER / unsafe class), `auto_fix_applied` is `false` and `findings` reflects the original unchanged verdict.

Wrap the object in the same `<forgeflow-verdict-json>...</forgeflow-verdict-json>` sentinels the wrapper's Python extractor expects. Nothing may follow.

Exit code after emission:
- `auto_fix_status == success` → exit 0
- `auto_fix_status == cap-reached` → exit 1 (re-review verdict still REVISE/BLOCK)
- `auto_fix_status == aborted-unsafe` → exit 1 (no fixes applied; verdict unchanged)
- `auto_fix_status == push-failed` → exit 2 (fixes computed but not pushed)

## Step 8: Safeguards (enforced throughout)

- NEVER modify files under `migrations/` or `db/migrations/` — always classify as BLOCKER
- NEVER modify files matching `*.env*`, secrets, or credentials — always classify as BLOCKER
- NEVER force-push, never amend, never `git reset --hard`
- NEVER touch `package.json` dependencies — always classify as MUST-FIX-RISKY
- If more than 10 files change in a single iteration, abort and revert
- If any worker returns `"REQUIRES MULTI-FILE CHANGE"`, reclassify that finding as MUST-FIX-RISKY and do not auto-apply

</process>

<success_criteria>
- [ ] Initial /review run completed
- [ ] Forgeflow implement agents verified present; missing agents prompted for user-picked replacements or skip
- [ ] Agent substitution map (if any) recorded in review-history round entry
- [ ] Findings classified by tier AND by source reviewer AND mapped to target implement agent
- [ ] Warden-flagged items never auto-applied (forced to MUST-FIX-RISKY)
- [ ] Workers dispatched via Forgeflow implement agents (or user-picked replacements) — not generic subagents
- [ ] Worker prompts use the Forgeflow team's injected-context + file-scope pattern
- [ ] User confirmed before any auto-apply (unless dry-run)
- [ ] Iteration 2+ re-prompts on new risky items or new file targets
- [ ] Validation gate enforced (timeout-guarded typecheck + lint + <=10 files + no new untracked)
- [ ] Worker non-SUCCESS returns handled (MULTI-FILE, NOT FOUND, UNEXPECTED ERROR all reclassify)
- [ ] Auto-fix commit separate from user work, references round number + prior verdict
- [ ] Round appended to `.forgeflow/<project>/review-history.md` so `/ship` gate reads it
- [ ] Patterns persisted to Atlas agent-notes for next-cycle preemption
- [ ] Iteration cap respected (default 2, max 3)
- [ ] Remaining risky items surfaced with explicit "surfaced for human judgment" framing
- [ ] Never touched migrations, secrets, or package.json dependencies
</success_criteria>
