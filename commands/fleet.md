---
name: fleet
description: Orchestrate a parallel worktree fleet — decompose a phased spec into shards, run each in an isolated worktree with its own DB, merge sequentially with validation
argument-hint: "--spec <file.md> [--shards N (default 3, max 10)] [--base-branch main] [--branch-prefix fleet] [--dry-run] [--environment <contract.json>]"
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
Collapse multi-phase refactors from weeks to hours by running independent phase-shards in parallel worktrees. Each worktree has its own DB (isolated via Postgres DB name per worktree). Legacy standard ports allow only one worktree to run dev services at a time. The optional environment contract lane supports explicitly isolated local services after their ports and resources are verified.

**Forgeflow integration:** Workers dispatched to each worktree are Forgeflow implement agents (builder-implement, architect-implement, etc.) per the spec's phase-to-domain mapping. After parallel completion, the main worktree sequentially rebase-merges each shard with validation (typecheck/lint/tests) between merges. Coordinator persistent context (.forgeflow/<project>/) is shared across worktrees.
</objective>

<context>
$ARGUMENTS:
- `--spec <file.md>` — required. A phased markdown spec with one `## Phase N: <title>` header per independent shard. Each phase must be self-contained (no file dependencies on sibling phases). Example at end of this document.
- `--shards N` — optional, default 3, max 10. Above 5 shards, verify Postgres can handle N+1 databases and the host has ~1GB free per worktree for node_modules. Community pattern (batch-with-worktrees) scales to 10–30 — pragmatic cap here is 10 to keep merge-chain validation tractable.
- `--base-branch <name>` — optional, default: `git remote show origin | grep 'HEAD branch'`
- `--branch-prefix <name>` — optional, default: `fleet` (worktree branches become `fleet-wt1`, `fleet-wt2`, etc.)
- `--dry-run` — plan the decomposition, print shard assignments, do not create worktrees

- `--environment <contract.json>` — optional stack-neutral environment and ownership contract. Use the contract lane below instead of the legacy pnpm/Postgres setup.

Safety flags:
- `--skip-db-isolation` — use the main DB for all worktrees (NOT recommended — kept for SQLite projects or single-DB setups)
- `--keep-on-failure` — leave worktrees intact if merge/validation fails (for debugging)
</context>

## Gotchas
- **Legacy mode allows ONE service-running worktree.** Its ports are shared. Serialize service-needing phases, or use the optional environment contract lane with verified distinct ports and resources.
- **Isolated DB requires Postgres admin.** The psql `CREATE DATABASE` call runs as the user's default psql account. If that account lacks CREATEDB privilege, fleet aborts at Step 3. Verify with `psql -c "SELECT current_user, has_database_privilege(current_user, 'postgres', 'CREATE')"`.
- **Legacy independence uses Files: metadata.** List every file a phase edits. The environment contract lane additionally checks actual changed paths against declared ownership before shard acceptance.
- **Non-trivial merge conflicts STOP the chain.** Remaining shards stay unmerged in their worktrees. The main branch is left at the last successful merge. Resolve the conflict manually, commit, then re-run `/fleet --shards 1 --spec <remaining-phase.md>` OR do the remaining shards as normal work outside fleet.
- **Failures preserve worktrees and resources.** Inspect the recorded run state before resuming. Successful cleanup uses ordinary worktree removal and merged-branch deletion; dirty or unmerged work is retained.
- **Auto-review at Step 6.5 scopes to merged commits only.** It runs `/review <base>..HEAD`. Previous unreviewed commits on the branch are outside scope. If you want to review everything, run `/review` manually without the range after fleet completes.

## Optional environment contract lane

For `--environment <contract.json>`, use a versioned local contract:

```json
{
  "schema_version": "1",
  "cleanup": "preserve-on-failure",
  "shards": [
    {
      "id": "api",
      "worktree": ".worktrees/api",
      "base": "<starting-commit-sha>",
      "files": ["src/api", "tests/api"],
      "ports": [4101],
      "resources": ["fleet_api_data"],
      "setup": [["npm", "ci", "--ignore-scripts"]],
      "validation": [["npm", "test"]]
    }
  ]
}
```

Paths are literal repository-relative paths; directory ownership includes descendants. Declare every changed file. Before dispatching work, record each shard's starting commit using `git rev-parse HEAD` and freeze that full commit SHA in its required `base` field. Preserve this baseline throughout the run so committed shard changes remain in the ownership check. Missing bases, abbreviated hashes, and moving refs such as `HEAD` or branch names are rejected; they cannot establish complete ownership evidence.

Validate after worktrees exist and again before accepting each shard:

```bash
node scripts/forgeflow/fleet-environment.js --contract <contract.json> --root <repository>
```

The helper is read-only: it checks separate worktree roots in the same repository, overlapping ownership, distinct port/resource declarations, argv structure, and actual git changes including untracked files. It never executes commands or reserves resources. An `attention` result exits nonzero and lists unowned files. Missing/unsafe worktrees are errors.

For this lane, replace the legacy tool/database preflight and setup with the contract's requirements. Create fresh isolated worktrees, then review setup/validation argv against the task authorization before running them through the host in the assigned worktree. Pass argv directly without shell interpolation. Service-dependent shards may overlap only when each live service has its own checked port and disposable data resource; declarations alone do not establish isolation. Start services through host-managed sessions, verify their responses, record exactly which resources/processes this run created, and stop only those processes. Do not kill an occupied listener. Setup and validation failures preserve the worktree, outputs, and resource ownership record for inspection. External writes still require the user's existing authorization.

The local regression fixture proves two loopback services and separate file resources can operate concurrently. It does not establish arbitrary database/container isolation. Legacy fleet invocations retain the single-service restriction below.

<process>

## Step 0: Pre-flight

### 0a. Tool availability
```bash
command -v git >/dev/null || { echo "git required"; exit 1; }
command -v pnpm >/dev/null || { echo "pnpm required"; exit 1; }
command -v lsof >/dev/null || { echo "lsof required for port checks"; exit 1; }
command -v psql >/dev/null || { echo "psql required (install postgres client)"; exit 1; }
```

### 0b. Repo state
```bash
pwd
git rev-parse --show-toplevel
git branch --show-current
git status --porcelain
```
If the working tree is dirty, STOP: `"Uncommitted changes in main worktree. Commit or stash before running /fleet."` Do not silently stash — user needs to decide.

### 0c. Base branch detection
```bash
BASE_BRANCH=${BASE_BRANCH:-$(git remote show origin 2>/dev/null | awk '/HEAD branch/ {print $NF}' || echo main)}
```

### 0d. DB config detection
Read `packages/database/drizzle.config.ts` or the closest `.env` / `.env.example` to find the DB name and connection URL. Parse:
- DB name (default for GSD projects: `gsd`)
- User (default: `postgres`)
- Host / port (default: `localhost:5432`)
- Password (from env or .env file — do not print)

If drizzle.config.ts is missing and no `.env` with `DATABASE_URL`, ask the user before proceeding:
```
Cannot auto-detect DB config. Provide:
1. DB name base (e.g., "gsd")
2. Connection URL template
```

## Step 1: Parse spec and decompose

### 1a. Read spec
```bash
SPEC_FILE="<--spec argument>"
[ ! -f "$SPEC_FILE" ] && { echo "Spec file not found: $SPEC_FILE"; exit 1; }
```

### 1b. Extract phases
Find all `## Phase N: <title>` headers. For each phase, capture:
- Phase number (N)
- Title
- Body (until next `## Phase` or EOF)
- Any `**Target agent:**` or `**Files:**` metadata lines inside the phase body

If the spec declares more phases than `--shards`, merge adjacent phases until count matches. If fewer, shards = phase count.

### 1c. Validate independence
For each pair of phases, check that file paths mentioned in `**Files:**` metadata do not overlap. If they do, STOP:
```
Phase N and Phase M both target <overlapping-file>. Phases must be independent for parallel execution.
Either rewrite the spec to consolidate overlapping work into one phase, or run /fleet on a subset of phases.
```

### 1d. Assign target agents per phase
For each phase, determine the target Forgeflow implement agent from the phase metadata OR by content heuristic:
- DB / schema / migrations → `builder-implement` (default)
- Auth / security / validation → `guardian-implement`
- Frontend / UX / components → `designer-implement`
- Cross-cutting architecture → `architect-implement`
- Backend general → `builder-implement`

If `--dry-run`: print the decomposition table and exit:
```
| Shard | Phase | Title | Target agent | Files |
|-------|-------|-------|--------------|-------|
| 1     | 2     | ...   | ...          | ...   |
```

## Step 2: Port pre-flight

Inspect the ports required by the project or environment contract before starting services. Identify any occupied listener and retain it; choose an unused declared port or serialize the service work. A prior fleet-looking path is not permission to terminate its process.

Legacy mode uses shared standard ports and permits only one service-running worktree at a time. The optional environment contract lane permits concurrent services only after distinct ports and disposable resources have been provisioned and verified. Keep the service ownership/session identifiers with the run so cleanup can target only resources created by this run.

## Step 3: Create worktree fleet

### 3a. Directory setup
```bash
WORKTREES_DIR="$(git rev-parse --show-toplevel)/.worktrees"
mkdir -p "$WORKTREES_DIR"
```

### 3b. For each shard (1..N)
```bash
for i in $(seq 1 $SHARDS); do
  WT_NAME="${BRANCH_PREFIX}-wt${i}"
  WT_PATH="${WORKTREES_DIR}/${WT_NAME}"
  WT_BRANCH="${BRANCH_PREFIX}/wt${i}"

  # Create worktree with a new branch from base
  git worktree add "$WT_PATH" -b "$WT_BRANCH" "$BASE_BRANCH"

  # Copy .env with isolated DB name (unless --skip-db-isolation)
  if [ ! "$SKIP_DB_ISOLATION" = "true" ]; then
    DB_NAME="${DB_NAME_BASE}_wt${i}"

    # Create isolated Postgres DB
    psql -h "$DB_HOST" -U "$DB_USER" -c "CREATE DATABASE ${DB_NAME};" 2>&1 \
      | grep -v "already exists" \
      || echo "DB ${DB_NAME} created or already existed"

    # Write worktree's .env with overridden DB name
    cp .env "$WT_PATH/.env"
    sed -i "s|/${DB_NAME_BASE}|/${DB_NAME}|g" "$WT_PATH/.env"

    # Run migrations in the worktree
    (cd "$WT_PATH" && pnpm install --frozen-lockfile && pnpm -F database migrate) \
      || { echo "Migration failed in wt${i}"; exit 1; }
  fi

  # Link .forgeflow/ so Coordinator persistent context is shared
  ln -sfn "$(git rev-parse --show-toplevel)/.forgeflow" "$WT_PATH/.forgeflow"

  # Link shared node_modules if the setup allows (optional optimization)
  # Skipped by default — pnpm handles this via the monorepo lockfile

  echo "Worktree $i: $WT_PATH (branch $WT_BRANCH, DB $DB_NAME)"
done
```

## Step 4: Dispatch parallel agents

### 4a. Per-phase worker prompt
For each shard in parallel, dispatch via `Agent` with `subagent_type=<target-agent>` determined in Step 1d. Each worker prompt:

```
You are the implement-mode agent assigned to fleet shard {i} of {N}.

Working directory: {WT_PATH}
Branch: {WT_BRANCH}
Base branch: {BASE_BRANCH}
Isolated DB: {DB_NAME}

Your phase:
<phase N body verbatim from the spec, including Title, Files, and acceptance criteria>

Hard constraints:
1. cd to {WT_PATH} before any file operation. Do NOT edit files outside this worktree.
2. Legacy mode: do NOT start services because standard ports are shared. Environment contract mode: only start the assigned service through a host-managed session after its declared port and disposable resource isolation have been verified; record the session and resource ownership for cleanup.
3. You MAY run: unit tests that don't bind ports, typecheck, lint, file edits, migrations against the isolated DB, `git add`, `git commit`.
4. You MAY NOT run: `git push`, `git merge`, `git rebase`. The main worktree handles merging.
5. If you hit an unresolvable blocker (e.g., need a running service, phase scope ambiguous), commit any partial work with a WIP: prefix and return "BLOCKED: <one-line reason>".
6. On successful phase completion, ensure:
   - All target files exist and compile (`pnpm typecheck`)
   - All changes are committed to {WT_BRANCH}
   - Return "DONE: <one-line summary>" along with the list of commits made
7. Do NOT touch .forgeflow/ contents — it is shared via symlink.

Coordinator persistent context: .forgeflow/<project>/agent-notes/
```

### 4b. Dispatch
Send all N agents in a single message via multiple Agent tool calls. Collect results as they return.

### 4c. Handle partial failure
If one or more workers return `BLOCKED:`:
- The other shards may have completed successfully
- Proceed to Step 5 with only DONE shards
- Surface BLOCKED shards at end for user to resume manually

## Step 5: Sequential rebase-merge into main

Return to the main worktree:
```bash
cd "$(git rev-parse --show-toplevel)"
git checkout "$BASE_BRANCH"
git pull --ff-only origin "$BASE_BRANCH"
```

### 5a. For each DONE shard (in declared order)
```bash
for i in $(seq 1 $SHARDS); do
  [ "${STATUS[$i]}" != "DONE" ] && { echo "Skipping wt${i}: ${STATUS[$i]}"; continue; }

  WT_BRANCH="${BRANCH_PREFIX}/wt${i}"

  # Attempt merge (not rebase — preserve the shard's commits)
  git merge --no-ff --no-edit "$WT_BRANCH" 2>&1 | tee /tmp/fleet-merge-wt${i}.log
  MERGE_EXIT=${PIPESTATUS[0]}

  if [ $MERGE_EXIT -ne 0 ]; then
    # Check conflict type
    CONFLICTS=$(git diff --name-only --diff-filter=U)
    TRIVIAL=true
    for f in $CONFLICTS; do
      # Trivial if conflict is only in import ordering or whitespace
      git diff "$f" | grep -qE '^[<=>]{7}' && TRIVIAL=false
    done

    if [ "$TRIVIAL" = true ]; then
      # Auto-resolve (imports, formatting)
      pnpm prettier --write $CONFLICTS 2>/dev/null || true
      git add $CONFLICTS
      git merge --continue --no-edit
      echo "wt${i}: trivial conflicts auto-resolved"
    else
      echo "wt${i}: non-trivial conflicts in: $CONFLICTS"
      git merge --abort
      break  # Stop the merge chain; surface to user
    fi
  fi

  # Validate after merge
  timeout 300 pnpm typecheck 2>&1 | tail -20
  TC_EXIT=${PIPESTATUS[0]}
  timeout 120 pnpm lint 2>&1 | tail -20
  LINT_EXIT=${PIPESTATUS[0]}

  if [ $TC_EXIT -ne 0 ] || [ $LINT_EXIT -ne 0 ]; then
    echo "wt${i}: validation failed after merge. Preserving the merge and worktree for inspection."
    # Record the failed validation and reconcile before continuing. Do not reset history.
    break
  fi

  echo "wt${i}: merged and validated"
done
```

### 5b. Stop-on-failure behavior
If any merge fails validation, stop the chain and preserve the failed merge plus validation output for inspection. Do not report the main branch as validated. Reconcile by fixing forward or by an explicitly authorized revert before continuing; remaining shards stay in their worktrees.

## Step 6: Teardown

### 6a. Preserve failures

Any failed setup, merge, ownership check, or validation preserves the affected worktree and resource record. `--keep-on-failure` remains accepted for compatibility; failure preservation is always enabled. Do not delete data resources or branches to make a rerun pass.

### 6b. Successful cleanup

Only clean a shard recorded as successfully merged and validated in this run. Check its worktree status and use ordinary removal, which refuses dirty work:

```bash
git worktree remove "$WT_PATH"
git branch -d "$WT_BRANCH"
```

If either refuses, preserve the shard and report the next inspection step. Drop disposable databases or remove other resources only when the run's ownership record confirms they were created by this run and the configured cleanup policy permits it. Never infer ownership from a name alone. Stop only the service sessions started by this run; do not terminate unrelated listeners.

## Step 6.5: Auto-review merged state (Forgeflow integration)

If ONE OR MORE shards were successfully merged into `$BASE_BRANCH` during Step 5, run the Forgeflow on the merged diff before returning control to the user. Without this step, the user would have to manually remember to run `/review` before `/ship`, and the fleet's merged work would sit unreviewed.

### 6.5a. Determine review scope
```bash
# Diff of everything merged by this fleet run vs the pre-fleet HEAD
MERGED_COUNT=$(echo "${STATUS[@]}" | tr ' ' '\n' | grep -c 'DONE+MERGED')
```

If `MERGED_COUNT` is 0, skip this step and go straight to Step 7 — no merged work to review.

### 6.5b. Invoke /review on the merged range
If `MERGED_COUNT` > 0:
- Determine the base commit: the commit that was HEAD before the first successful fleet merge
- Invoke `/review <base>..HEAD` — scopes the review to fleet-merged commits only

The review's own Step 0 pre-flight gate will run typecheck/lint on the merged state. If pre-flight fails, the Forgeflow will surface that immediately (rather than silently shipping broken code from parallel shards).

For fleet runs merging large shard counts, `/review` Step 0.5 (classifier) and Step 3.6 (chunking) automatically apply — the merged range is classified and, if > 30 files, chunked before reviewer dispatch. No fleet-side handling needed; inherit the behavior from `/review`.

### 6.5c. Handle verdict
The `/review` invocation returns one of:
- **APPROVE + CONFIRM:** proceed to Step 7. Final report notes "review PASSED" and the user can go straight to `/ship`.
- **REVISE / BLOCK:** the auto-handoff in `/review` already kicks in when context is constrained. In Step 7's report, surface that the fleet merged successfully BUT review found issues. User must address findings before `/ship`.

Do NOT auto-revert fleet merges on REVISE — the merges represent real user-authored shard work (via Forgeflow implement agents). The user decides whether to fix-forward or revert.

## Step 7: Report

Print a summary:
```
## Fleet run complete

Spec: {SPEC_FILE}
Base: {BASE_BRANCH}
Shards: {N}

| Shard | Phase | Agent | Status | Commits |
|-------|-------|-------|--------|---------|
| 1 | 2 | fc | MERGED | 3 |
| 2 | 3 | designer | MERGED | 2 |
| 3 | 4 | fc | BLOCKED: needs running service | 1 (WIP) |

Next actions:
- Shard 3 needs manual resume: cd .worktrees/fleet-wt3, start service, continue phase.
- Main branch now ahead by {X} commits. Run /review before /ship.
```

If any shards blocked or failed, leave the failing worktrees in place and the user's .env untouched.

</process>

<success_criteria>
- [ ] Pre-flight validated (tools, repo clean, base branch detected)
- [ ] Spec parsed into N phases, independence verified, target agents assigned
- [ ] Port pre-flight completed (occupied listeners preserved; service ownership recorded)
- [ ] N worktrees created with isolated DBs (`gsd_wt1` pattern) and linked `.forgeflow/`
- [ ] Agents dispatched in parallel, one per worktree, scoped to one phase
- [ ] Sequential merge executed with per-shard typecheck+lint validation
- [ ] Non-trivial conflicts abort the chain, trivial conflicts auto-resolve via prettier
- [ ] Successful shards torn down (worktree + branch + DB); failed shards kept for inspection
- [ ] Final report covers merged/blocked/failed per shard with clear next actions
</success_criteria>

<example_spec>
## Example spec — save as `refactor.fleet.md`

```markdown
# Refactor: queue management cleanup

## Phase 1: Extract queue selector hook
**Target agent:** builder-implement
**Files:** apps/backoffice/src/hooks/useQueueSelector.ts, apps/backoffice/src/hooks/useQueueSelector.test.ts
**Acceptance:** Hook exists, unit tests pass, no other files changed.

## Phase 2: Migrate queue dropdown to new hook
**Target agent:** designer-implement
**Files:** apps/backoffice/src/components/QueueDropdown.tsx
**Acceptance:** Component uses the new hook, visual output unchanged, tsc clean.

## Phase 3: Add queue persistence to user settings
**Target agent:** builder-implement
**Files:** packages/database/src/schema/userSettings.ts, packages/database/migrations/*
**Acceptance:** Migration creates column, schema type updated, unit test confirms default.
```
</example_spec>
