---
name: review
description: Run the Forgeflow on changed files in the current session or working tree
argument-hint: "[file paths or git ref, e.g., 'HEAD~3' or 'src/auth.ts src/db.ts']"
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
```bash
FORGEFLOW_REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel 2>/dev/null || true)"
FORGEFLOW_INIT_SESSION="${FORGEFLOW_REPO_ROOT}/services/chat-bridge/init-session.sh"
if [ -f "$FORGEFLOW_INIT_SESSION" ]; then
  source "$FORGEFLOW_INIT_SESSION" "review" "$*"
else
  CHAT_AVAILABLE=false
  CHAT_SEND=""
  ROOM_NAME="review"
  export CHAT_AVAILABLE CHAT_SEND ROOM_NAME
fi
```
<objective>
Run the Forgeflow review team on changed files. Works in any project.

The Forgeflow team: `smith-review`, `warden-review`, `lumen-review`, `atlas-review` (parallel) → `arbiter-review` (synthesis) → `compass-review` (final).
</objective>

<context>
$ARGUMENTS — Optional. Can be:
- Empty: Reviews all uncommitted changes (staged + unstaged)
- File paths: Reviews specific files (e.g., "src/auth.ts src/routes/api.ts")
- Git ref: Reviews changes since a ref (e.g., "HEAD~3" or "main..HEAD")
- `--skip-preflight`: Skip the Step 0 gate (use only when you have a justification)
- `--pr <N>`: Explicitly bind this review to PR #N (enables branch-assertion check)
- `--mode <skip|thin|full|deep>`: Override the Step 0.5 classifier
- `--calibration <path>`: Optional calibration summary for telemetry-informed routing. Defaults to `.forgeflow/<project>/calibration-summary.json` when present
- `--incremental`: When the argument is a commit range (e.g., `HEAD~3..HEAD`), review each commit separately, carrying findings from earlier commits forward as context (see Step 1.5)
- `--ci`: Headless mode. Suppress markdown narrative; emit a single `<forgeflow-verdict-json>...</forgeflow-verdict-json>` block per `docs/forgeflow-json-schema.md`. Auto-enabled when `CLAUDE_CODE_HEADLESS=1` is set. In CI, classifier caps at thin-mode unless deep-mode triggers fire (aggressive pre-filter; overridable with `--mode`)
</context>

<process>

## Step 0: Pre-Flight Gate

Before spawning any reviewer agents, verify session context and validate the working tree. The Forgeflow is expensive — do not invoke it on code that has not passed basic validation.

### 0a. Session context verification
Run in a single parallel Bash block:
```bash
pwd
git branch --show-current
git status -sb
gh pr view --json number,title,headRefName 2>/dev/null || true
```

Output a one-line confirmation:
`"Reviewing <branch> in <cwd>[ · PR #<N>: <title>]"`

### 0b. Branch assertion (blocking)
If $ARGUMENTS contains `--pr <N>` OR `gh pr view` returned a `headRefName`:
- Compare `git branch --show-current` against the expected PR branch
- If mismatch, STOP with:
  `"Branch mismatch: currently on '<current>', PR #<N> expects '<expected>'. Switch branches or clarify intent before continuing."`
- Do not spawn reviewers.

### 0c. Validation gate (blocking unless --skip-preflight)
If $ARGUMENTS contains `--skip-preflight`, skip this step but note in the final verdict that preflight was bypassed.

Otherwise, if `package.json` exists in the working directory or any parent up to the repo root:
- If it declares a `typecheck` script: run `pnpm typecheck 2>&1 | tail -40`
- If it declares a `lint` script: run `pnpm lint 2>&1 | tail -40`

If either returns a non-zero exit code, STOP with:
```
Pre-flight failed: [typecheck|lint] returned errors.

First 10 lines of output:
<first 10 lines>

The Forgeflow only reviews code that compiles and lints clean. Fix the errors and re-run /review.
To override, re-run with --skip-preflight.
```
Do not spawn reviewers.

### 0d. Test advisory (non-blocking)
If `package.json` declares a `test` script AND any changed file is a source file likely covered by tests, emit a one-line advisory:
`"Tests not run during pre-flight — run 'pnpm test' after review if changes affect test coverage."`
Continue to Step 0.5.

## Step 0.4: Headless-mode detection

Set `CI_MODE=true` if `$ARGUMENTS` contains `--ci` OR the environment variable `CLAUDE_CODE_HEADLESS=1` is set. Otherwise `CI_MODE=false`.

When `CI_MODE=true`:
- Suppress all markdown narrative output from Steps 7-8. Steps still execute; their outputs are collected into memory for the final JSON emission in Step 7.5 (added below).
- The classifier (Step 0.5) caps routing at `thin-mode` unless `deep-mode` triggers fire, unless the user passed an explicit `--mode` flag.
- Errors from Step 0 (pre-flight failures) produce an `ABORTED` verdict JSON block instead of stopping with a user-facing message.

### Unsupported flag combinations in CI

- `--incremental + --ci` — the schema has no per-commit verdict structure. When both are set, the orchestrator prints a one-line warning (to stderr), then proceeds as if `--incremental` were not set — aggregate review over the range, single verdict JSON. Step 1.5 checks `CI_MODE` at entry and short-circuits back to Step 2 when true. This is intentional: per-commit review on a PR adds cost without a clean way to surface per-commit verdicts in the PR comment. If you need per-commit review, run `/review HEAD~N..HEAD --incremental` locally.

## Step 0.5: Diff classifier (routing)

Classify the diff so the Forgeflow team can skip trivial changes, run thin on small ones, and escalate on high-risk surfaces. Output a single `ROUTING_MODE` that the rest of the command consults. Prefer the shared route helper when this Forgeflow checkout includes it; fall back to the inline rules when the helper is unavailable.

### 0.5a. Collect routing signals

```bash
# Use the same file set that Step 1 will resolve — and use the same CI/interactive
# diff source. In CI the working tree is clean (checkout produces no diff vs HEAD),
# so we must diff against the PR base branch; interactively we diff the working tree.
if [ -n "${GITHUB_BASE_REF:-}" ] || echo "$ARGUMENTS" | grep -q -- '--pr '; then
  BASE_REF="${GITHUB_BASE_REF:-main}"
  git fetch origin "${BASE_REF}" 2>/dev/null || true
  git diff --name-only "origin/${BASE_REF}..HEAD" 2>/dev/null > /tmp/_review_files_$$
  LINES_CHANGED=$(git diff --numstat "origin/${BASE_REF}..HEAD" 2>/dev/null | awk '{s+=$1+$2} END {print s+0}')
else
  git diff --name-only HEAD 2>/dev/null > /tmp/_review_files_$$
  git diff --name-only --cached 2>/dev/null >> /tmp/_review_files_$$
  git ls-files --others --exclude-standard 2>/dev/null >> /tmp/_review_files_$$
  LINES_CHANGED=$(git diff --numstat HEAD 2>/dev/null | awk '{s+=$1+$2} END {print s+0}')
fi
sort -u /tmp/_review_files_$$ > /tmp/_review_files_unique_$$
FILES=$(cat /tmp/_review_files_unique_$$)
FILE_COUNT=$(echo "$FILES" | grep -c . || echo 0)
```

### 0.5a.1. Prefer shared route helper

If a Forgeflow route helper exists in project-local `scripts/forgeflow/` or the installed `$HOME/.claude/forgeflow/scripts/forgeflow/` helper root, use it as the authoritative classifier so Claude and Codex reviews share the same routing policy:

```bash
PROJECT_NAME=$(basename "$(pwd)")
HELPER_DIR="scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/explain-review-route.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/explain-review-route.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
DEFAULT_CALIBRATION=".forgeflow/${PROJECT_NAME}/calibration-summary.json"
CALIBRATION_ARG=""

if echo "$ARGUMENTS" | grep -q -- '--calibration '; then
  CALIBRATION_PATH=$(echo "$ARGUMENTS" | sed -n 's/.*--calibration \([^ ]*\).*/\1/p' | head -1)
elif [ -f "$DEFAULT_CALIBRATION" ]; then
  CALIBRATION_PATH="$DEFAULT_CALIBRATION"
else
  CALIBRATION_PATH=""
fi

if [ -n "$CALIBRATION_PATH" ] && [ -f "$CALIBRATION_PATH" ]; then
  CALIBRATION_ARG="--calibration $CALIBRATION_PATH"
fi

MODE_ARG=""
if echo "$ARGUMENTS" | grep -q -- '--mode '; then
  MODE_OVERRIDE=$(echo "$ARGUMENTS" | sed -n 's/.*--mode \([^ ]*\).*/\1/p' | head -1)
  MODE_ARG="--mode $MODE_OVERRIDE"
fi

CI_ARG=""
if [ "$CI_MODE" = "true" ]; then
  CI_ARG="--ci"
fi

ROUTING_JSON=$("${HELPER_DIR}/explain-review-route.js" --json --files /tmp/_review_files_unique_$$ --lines "$LINES_CHANGED" $MODE_ARG $CI_ARG $CALIBRATION_ARG)
ROUTING_MODE=$(printf '%s' "$ROUTING_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>console.log(JSON.parse(s).mode))')
ROUTING_VERIFIER=$(printf '%s' "$ROUTING_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>console.log(JSON.parse(s).verifier||"not-required"))')
ROUTING_TELEMETRY_HINTS=$(printf '%s' "$ROUTING_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>console.log((JSON.parse(s).telemetry_hints||[]).map(h=>`${h.type}:${h.class}`).join(", ")))')
```

When the helper succeeds, skip Step 0.5b and use its JSON in prompts, Arbiter synthesis, final output, and CI metadata. `telemetry_hints` are explanatory; they must not suppress Lumen on UI/accessibility files.

### 0.5b. Classify

If the shared route helper is unavailable, apply these rules in order. First match wins. Routing output is one of: `skip-mode` | `thin-mode` | `full-mode` | `deep-mode`.

1. **deep-mode** — if ANY of:
   - File path matches `migrations/`, `migrate/`, `schema/`, or filename ends in `.sql`
   - File path matches `auth*`, `passport*`, `session*`, `oauth*`, `login*`, `token*` (code files)
   - File path matches `crypto*`, `jwt*`, `password*`, `permission*`, `rbac*`
   - File is a CSP header, CORS config, or cookie config
   - Commit message body (last 5 commits) contains "security", "cve", "vulnerability", "rbac"

2. **skip-mode** — if ALL of:
   - Every changed file has extension `.md`, `.txt`, or is in `docs/`, `README*`
   - No file under `src/`, `lib/`, `apps/`, `packages/*/src/`
   - `LINES_CHANGED` ≤ 200

3. **thin-mode** — if ANY of:
   - Every changed file matches `*.test.ts`, `*.spec.ts`, `*.test.tsx`, `*.spec.tsx`, `tests/`, `__tests__/`, `e2e/`
   - Every changed file is a lockfile or package.json version bump (diff contains only `"version":` changes in package.json; lockfile auto-regen)
   - `FILE_COUNT` ≤ 2 AND `LINES_CHANGED` ≤ 50 AND no frontend files (no `.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss`)

4. **full-mode** — default

### 0.5c. Apply routing

```
case "$ROUTING_MODE" in
  skip-mode)
    Output: "Diff classified as docs-only (<N> files, <M> lines). Skipping Forgeflow — no code changes detected."
    Exit cleanly with no Forgeflow spawn.
    ;;
  thin-mode)
    Output: "Diff classified as <test-only|lockfile-bump|trivial> — running thin mode (Smith + Warden only)."
    Continue. Step 4 will use thin roster.
    ;;
  full-mode)
    Output: "Diff classified as full review — running standard Forgeflow."
    Continue.
    ;;
  deep-mode)
    Output: "Diff classified as HIGH-RISK (<matched rule>) — running deep mode (full Forgeflow + Warden audit pass)."
    Continue. Step 4 will add Warden audit pass.
    ;;
esac
```

Export `ROUTING_MODE`, `ROUTING_JSON`, `ROUTING_VERIFIER`, and `ROUTING_TELEMETRY_HINTS` as shell variables for downstream steps when available.

### 0.5d. Classifier override

If `$ARGUMENTS` contains `--mode <skip|thin|full|deep>`, override the classifier and use the specified mode. Skip steps 0.5a and 0.5b. This gives the user escape hatches for when the heuristic is wrong.

### 0.5d.1. CI cap

When `CI_MODE=true` AND no `--mode` override was provided:
- If the classifier returned `full-mode`, DOWNGRADE to `thin-mode` (CI saves cost on routine diffs).
- If the classifier returned `deep-mode`, KEEP `deep-mode` (security matters even in CI).
- `skip-mode` and `thin-mode` pass through unchanged.

Record `routing_override: "ci-cap"` in the emitted JSON when the cap fired. An explicit `--mode` flag disables the cap and is recorded as `routing_override: "user-mode"`.

### 0.5e. Future CI cost optimization (not wired in Phase 2 V1)

The Phase 2 V1 wrapper (`scripts/forgeflow-pr-review.sh`) runs the full `/review --ci` in the primary model (default `claude-opus-4-7`) and lets the orchestrator classify inline. This is the simplest wiring.

A future optimization — deferred to V5.1 — would pre-classify with `claude-haiku-4-5` before spawning the full review:

```bash
claude -p "$(cat <<EOF
Classify this diff into skip-mode | thin-mode | full-mode | deep-mode using the rules in Step 0.5b of /review. Output only the mode label on a single line, nothing else.

FILES:
$(cat /tmp/_review_files_unique_$$)

DIFF STATS:
$(git diff --stat HEAD 2>/dev/null | tail -20)
EOF
)" --model claude-haiku-4-5 --max-tokens 10
```

The wrapper would then call `/review --ci --mode <haiku-classified-mode>` to force the mode, saving opus tokens that would otherwise be spent re-classifying inline. Not worth the added complexity until telemetry shows opus classification cost is a meaningful slice of total CI cost.

## Step 1: Determine files to review

**If $ARGUMENTS contains `--pr <N>` OR the environment has `GITHUB_BASE_REF` set** (CI path — the working tree is clean after `actions/checkout`, so working-tree diffs produce nothing):
```bash
# Diff the PR branch against the base branch, two-dot form (linear diff).
BASE_REF="${GITHUB_BASE_REF:-main}"
git fetch origin "${BASE_REF}" 2>/dev/null || true
git diff --name-only "origin/${BASE_REF}..HEAD" 2>/dev/null
```

**Otherwise if $ARGUMENTS is empty** (interactive path):
```bash
# All modified/added files (staged + unstaged + untracked)
git diff --name-only HEAD 2>/dev/null
git diff --name-only --cached 2>/dev/null
git ls-files --others --exclude-standard 2>/dev/null
```
Deduplicate and filter out non-source files (.planning/, e2e/, .forgeflow/, node_modules/, etc.)

**If $ARGUMENTS looks like file paths** (contains `/` or `.`):
Use the listed files directly.

**If $ARGUMENTS looks like a git ref** (e.g., HEAD~3, main..HEAD, a commit SHA):
```bash
git diff --name-only $ARGUMENTS
```

If no files found, tell the user and exit.

## Step 1.5: Incremental mode (optional)

If `CI_MODE=true`, SKIP this step unconditionally and return to Step 2 — the `--incremental + --ci` combo is unsupported (see Step 0.4). A one-line stderr warning was already printed there.

Otherwise, if `$ARGUMENTS` contains `--incremental` AND the argument also contains a commit range (`<ref>..<ref>` or `HEAD~N..HEAD`):

### 1.5a. Enumerate commits

```bash
RANGE=$(echo "$ARGUMENTS" | grep -oE '[A-Za-z0-9_/^~.@{}-]+\.\.[A-Za-z0-9_/^~.@{}-]+|HEAD~[0-9]+\.\.HEAD' | head -1)
COMMITS=$(git rev-list --reverse "$RANGE")
COMMIT_COUNT=$(echo "$COMMITS" | grep -c .)
```

If `COMMIT_COUNT` > 10, warn the user: "Incremental review of >10 commits is expensive. Consider reviewing the aggregate diff instead." Ask `AskUserQuestion`: proceed / fall back to aggregate / abort.

### 1.5b. Loop — per-commit review

For each commit SHA in order:

1. Reset the file set to that commit's diff: `git diff --name-only $SHA^..$SHA`
2. Re-run Step 0.5 classifier against THIS commit's files (per-commit routing can differ from the range-level routing)
3. Re-run Step 3.5 context pre-loading with only this commit's files
4. Apply Step 3.6 chunking (usually skipped — single commits rarely exceed 30 files)
5. Spawn Step 4 reviewers. Each reviewer's prompt includes a new `<prior-findings>` block summarizing findings from earlier commits in this incremental run:

```
<prior-findings>
Earlier commits in this incremental review:

Commit <short-sha-1> (<subject line>):
  - Smith: <top 3 findings, truncated>
  - Warden: <...>
  - Arbiter verdict: <verdict>

Commit <short-sha-2> (<subject line>):
  - <...>

When reviewing the current commit, look for:
  1. Regressions — does the current commit undo a fix from an earlier commit in this range?
  2. Repeated patterns — does the current commit make the same class of mistake flagged earlier?
  3. Cross-commit incoherence — does the current commit conflict with architectural decisions implied by earlier commits?
</prior-findings>
```

6. Run Step 5 (Arbiter) for this commit with the prior-findings context.
7. Record Arbiter's verdict keyed by SHA.
8. Append per-commit results to an in-memory log for use in the next iteration.

### 1.5c. Aggregate verdict

After all commits reviewed:

```
## Incremental review — <N> commits in <range>

| SHA | Subject | Verdict | Blocking findings |
|---|---|---|---|
| abc123 | feat: add auth middleware | APPROVE | 0 |
| def456 | refactor: rename session token | REVISE | 2 |
| ghi789 | fix: handle null session | APPROVE | 0 |

Aggregate verdict: **REVISE** (weakest verdict wins, per-commit blockers listed inline)

Cross-commit signals:
- 2 regressions detected: def456 renamed session token without updating consumer in ghi789-adjacent file
- 1 repeated pattern: Smith flagged same null-safety gap in abc123 and ghi789
```

Skip Step 6 (Compass final review) per-commit. Run Compass ONCE at the end against the aggregate file set — Compass's validation is about the end state, not each intermediate commit.

Return from Step 1.5 after producing the aggregate report. Do not fall through to Step 2.

If NOT in incremental mode, continue to Step 2.

## Step 2: Classify files

Separate into:
- **Backend/general files** — reviewed by Smith, Warden, Atlas, Lumen (connectivity hat)
- **Frontend files** — Lumen also applies frontend hat
  Frontend detection: files in `frontend/`, `src/components/`, `src/pages/`, `public/`, or with extensions `.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss`, `.html`

Note: Lumen always participates. Frontend files activate his frontend hat. His connectivity hat (microservices data pathways, redundant calls, service integration) is always on.

## Step 3: Load Atlas's persistent context

```bash
PROJECT_NAME=$(basename "$(pwd)")
FORGEFLOW_DIR=".forgeflow/${PROJECT_NAME}"
mkdir -p "${FORGEFLOW_DIR}/agent-notes"
```

Ensure `.forgeflow/` is in `.gitignore`. If not, add it.

Also check for Compass's prior phase outputs:
```bash
PLAN_PATH="${FORGEFLOW_DIR}/current-plan.md"
DISCUSSION_PATH="${FORGEFLOW_DIR}/current-discussion.md"
RESEARCH_PATH="${FORGEFLOW_DIR}/current-research.md"
NOTES_PATH="${FORGEFLOW_DIR}/implementation-notes.md"
PROJECT_LEARNINGS_PATH="${FORGEFLOW_DIR}/project-learnings.md"
```

If each path exists, read the file and store its contents as `plan_content`, `discussion_content`, `research_content`, `implementation_notes_content`, and `project_learnings_content` respectively. Pass the file contents (not the paths) to Compass's prompt. Treat implementation notes as context for decisions, spec gaps, tradeoffs, deviations, follow-ups, and validation notes; they are not proof that the implementation is correct. Treat project learnings as guidance for recurring pitfalls, stable decisions, risk areas, validation patterns, hot files/modules, repeated follow-ups, and recommended next approach; they are not proof and every finding still needs current evidence.

## Step 3.4: Build local context pack

Prefer the local context compiler when available. It pre-computes route, file manifest, diff summary, indexed memory hits, latest project insights, and bounded per-agent packets so reviewer prompts do not need to carry the same full context repeatedly.

Skip this step only when `$ARGUMENTS` contains `--no-context-pack`.

```bash
CONTEXT_PACK_DIR="${FORGEFLOW_DIR}/context/latest"
CONTEXT_PACK_ARG=""

if ! echo "$ARGUMENTS" | grep -q -- '--no-context-pack' && [ -x "${HELPER_DIR}/build-context-pack.js" ]; then
  TASK_ARGS=()
  if [ -n "${ARGUMENTS:-}" ]; then
    TASK_ARGS=(--task "$ARGUMENTS")
  fi
  "${HELPER_DIR}/build-context-pack.js" \
    --files /tmp/_review_files_unique_$$ \
    --lines "$LINES_CHANGED" \
    $MODE_ARG \
    $CI_ARG \
    $CALIBRATION_ARG \
    "${TASK_ARGS[@]}" \
    --out "$CONTEXT_PACK_DIR" \
    --json
  CONTEXT_PACK_ARG="Use the local Forgeflow context packet for this agent from ${CONTEXT_PACK_DIR}/agent-packets/ when present. Treat it as the primary context and request expanded context only when the packet cites an unresolved gap."
fi
```

When `.forgeflow/${PROJECT_NAME}` exists, context pack generation also refreshes `.forgeflow/${PROJECT_NAME}/index/memory-index.json` and uses that local index before falling back to raw memory scans. It writes estimated context savings to `${CONTEXT_PACK_DIR}/context-telemetry.json`. Use `--no-memory-index` only when debugging index generation.

If `${HELPER_DIR}/check-context-budget.js` exists, run it after context pack generation. It reads `.forgeflow-budget.json` from the repo root when present. In interactive mode, use `--warn-only`; in CI mode, omit `--warn-only` so over-budget packets fail fast:

```bash
if [ -x "${HELPER_DIR}/check-context-budget.js" ]; then
  BUDGET_WARN_ARG="--warn-only"
  if [ "$CI_MODE" = "true" ]; then
    BUDGET_WARN_ARG=""
  fi
  "${HELPER_DIR}/check-context-budget.js" --root "$FORGEFLOW_DIR" --max-compact-tokens 16000 $BUDGET_WARN_ARG --json
fi
```

If the context pack exists, pass the matching `agent-packets/<agent>.md` file contents to each reviewer, `route.json` and `synthesis-input.json` to Arbiter, and `synthesis-input.json` plus Compass's phase artifacts to Compass. The packet includes a **Latest Insights** section from project learnings; agents may use it to anticipate recurring risks and validation patterns, but every finding still needs current evidence. If latest insights are blocked, read `latest-insights-report.json` for the gate status and top check issues. For JS/TS changes, packets also include a **Code Topology** section with static fan-in/fan-out and changed-file neighbor guidance, while `synthesis-input.json` exposes `code_topology_summary` for Arbiter and Compass. Treat topology as import-graph context, not runtime proof.

## Step 3.5: Context Pre-Loading

Apply the security denylist before reading any file: exclude `.env`, `*.pem`, `*.key`, `*.p12`, `*.cert`, `*.secret`, and any file with `password`, `secret`, or `token` in the filename (case-insensitive).

If Step 3.4 produced a context pack, use it as the default context source and only pre-load full file contents when one of these is true:
- `$ARGUMENTS` contains `--full-context`
- a reviewer explicitly needs an uncompressed source excerpt
- the file count is under 5 and total changed lines are under 100

**Discover:** All changed files identified in Step 1 (already resolved — no additional discovery needed).

**Read:** Read each changed file's contents into orchestrator context (one pass, after denylist filter). If the changed file count exceeds 20, log an advisory: "Large diff detected ({n} files) — pre-loading all files; monitor for context window pressure."

**Bundle (shared block):** All changed files go into `<shared-files>` — every review agent needs the same set. `<agent-files>` is empty for all review agents.

```xml
<injected-context>
<context-meta command="/review" agent="{agent-name}" files="{n}" complete="{true|false}" />

IMPORTANT: All file contents below are pre-loaded by the orchestrator. Do NOT call Read, Grep, or Glob for any file already present in this block. If you encounter a reference to an unlisted file during your review, note the gap in your output — do not self-expand scope.

<shared-files>
<file path="{changed-file-path}">
{file contents verbatim}
</file>
</shared-files>

<agent-files></agent-files>

</injected-context>
```

This same `<shared-files>` block is distributed to all agents in Step 4, Step 5 (Arbiter), and Step 6 (Compass).

## Step 3.6: Chunking (for diffs > 30 files)

Large diffs exhaust orchestrator context and produce shallow reviews. At `FILE_COUNT > 30`, split the review into chunks, run each chunk independently, and let Arbiter synthesize across chunks.

### 3.6a. Chunking decision

`FILE_COUNT` from Step 0.5a reflects the working tree. When `$ARGUMENTS` supplies explicit files or a git ref, Step 1 may have resolved a different file set. Recompute from Step 1's resolved list before checking the threshold:

```bash
# Recompute from the actual file set Step 1 resolved (not the Step 0.5 working-tree snapshot).
FILE_COUNT=$(echo "$RESOLVED_FILES" | grep -c . || echo 0)

if [ "$FILE_COUNT" -le 30 ]; then
  CHUNKED=false
  CHUNKS="all"   # single chunk = all files
else
  CHUNKED=true
fi
```

If `CHUNKED=false`, proceed to Step 4 with a single chunk — the existing `<shared-files>` block is that chunk.

### 3.6b. Chunking strategy

If `CHUNKED=true`:

1. **Monorepo detection.** Check for any of these at repo root: `pnpm-workspace.yaml`, `lerna.json`, `turbo.json`, `nx.json`, `rush.json`. If found, parse workspace globs and group changed files by the workspace package they belong to. Each package = one chunk.

2. **Non-monorepo fallback.** Group changed files by first-level path segment (e.g., `src/`, `apps/web/`, `apps/api/`, `lib/`, `migrations/`, `docs/`).

3. **Rebalance.** If any single chunk has >30 files, split that chunk by second-level subdirectory. Repeat until no chunk exceeds 30.

4. **Cap.** Maximum 8 chunks per review. If the natural grouping produces >8, merge the smallest adjacent chunks (by file count) until at 8. If files of very different domains merge (e.g., `docs/` + `migrations/` because both are small), note in the output: "Chunk N contains mixed domains due to 8-chunk cap — accept some loss of per-domain focus."

### 3.6c. Per-chunk context block

For each chunk, assemble its own `<shared-files>` block containing only that chunk's files:

```xml
<injected-context>
<context-meta command="/review" agent="{agent-name}" chunk="{chunk-label}" files="{n}" chunked_total="{TOTAL_CHUNKS}" />
<shared-files>
  <file path="..."> ... </file>
  ...
</shared-files>
<agent-files></agent-files>
</injected-context>
```

`chunk-label` format: `<strategy>-<name>`. Examples: `workspace-api`, `workspace-web`, `path-src`, `path-migrations`.

### 3.6d. Output chunking summary (pre-Step-4)

Emit one line per chunk:

```
Chunks: 5
  - workspace-api: 18 files (backend, spawns Warden + Smith + Atlas)
  - workspace-web: 12 files (frontend, spawns Warden + Smith + Lumen frontend + Atlas)
  - workspace-shared: 6 files (shared lib, spawns Smith + Warden)
  - path-migrations: 2 files (migrations, spawns deep-mode roster)
  - path-docs: 3 files (docs-only, would be skip but bundled here due to chunking)
```

Proceed to Step 4.

## Step 4: Spawn reviewers in parallel

Roster selection is driven by `ROUTING_MODE` from Step 0.5:

- **thin-mode**: spawn `warden-review` + `smith-review` only. Skip Lumen and Atlas. Go to Arbiter.
- **full-mode**: spawn all four reviewers in parallel (Smith, Warden, Lumen, Atlas).
- **deep-mode**: spawn all four reviewers PLUS `warden-audit` for a dedicated security sweep on the high-risk surfaces identified by the classifier. Warden's audit output is appended to Arbiter's input alongside the four review outputs.

Spawned agents receive:
- `smith-review` — with all changed files
- `warden-review` — with all changed files
- `lumen-review` — with all changed files (connectivity hat always on; if frontend files present, note which files activate his frontend hat too)
- `atlas-review` — with all changed files + FORGEFLOW_DIR path for persistent memory
- `warden-audit` (deep-mode only) — same file list but with an explicit mandate: "This review was classified as high-risk. Perform a full security audit pass against Tier 1 + Tier 2 checks from `agents/_shared/warden-security-intelligence.md`."

Include the routing note in every reviewer prompt:

```text
Routing note:
{ROUTING_JSON if available, otherwise ROUTING_MODE + inline classifier reason}
```

### Step 4 behavior under chunking

If `CHUNKED=false`: spawn the roster once on the full file set (existing behavior).

If `CHUNKED=true`:
- Iterate chunks SEQUENTIALLY (not all chunks in parallel — 4 × 8 = 32 concurrent agents is too many).
- Within each chunk, spawn the chunk's roster in parallel.
- Roster-per-chunk is determined by the chunk's file set passed through the Step 0.5 classifier rules (e.g., a migrations chunk runs deep-mode even if the overall diff was full-mode).
- Record each chunk's (Smith / Warden / Lumen / Atlas) output keyed by `chunk-label` so Arbiter can iterate them.
- After all chunks complete, proceed to Step 5.

Each agent prompt must include:
- `Use the Forgeflow context packet first. Do not re-read packeted files unless the packet cites a gap or you need exact source lines for a finding.` at the top of the task description
- The complete list of files to review
- Working directory path
- Brief context on what the changes are for (from git log or user description)
- The matching context packet from `${CONTEXT_PACK_DIR}/agent-packets/{agent}.md` when present; otherwise the assembled `<injected-context>` block from Step 3.5 (with `agent="{agent-name}"` filled in for each agent)
- A `<file-scope>` block hard-constraining the agent to the changed files:

```
<file-scope>
Review ONLY these files:
- [changed file 1]
- [changed file 2]
- ...
Files listed here that also appear in <injected-context> are pre-loaded — do not re-read them. Files listed here NOT in <injected-context> are permitted reads if you have genuine need.
</file-scope>
```

## Step 4.5: Neutral verification for high-risk findings

Before Arbiter synthesis, send high-risk findings through `aegis` when the agent is available. Trigger verification when any of the following are true:

- `ROUTING_VERIFIER == required`
- finding class is security, auth/session/permissions, migration/schema/data loss, critical correctness, broad refactor regression, or accessibility blocker
- `ROUTING_TELEMETRY_HINTS` contains a `noisy-class` hint for the finding class

Verifier prompt template:

```text
Verify this Forgeflow finding from visible evidence only.

Reviewer:
Finding class:
Claim:
Cited evidence:
Routing note:

Return:
Decision: CONFIRMED | REJECTED | BLOCKED
Evidence:
Reasoning:
Required next action:
```

Do not broaden scope. `CONFIRMED` requires concrete cited evidence. `REJECTED` and `BLOCKED` findings can still be shown to Arbiter, but they must not become blockers without Arbiter explicitly explaining why the verifier result is insufficient.

## Step 5: Spawn Arbiter

After all parallel agents complete, spawn `arbiter-review` with all their outputs concatenated.

Arbiter receives:
- `Use the Forgeflow synthesis packet first. Do not re-read packeted files unless exact source evidence is needed for a final finding.` at the top of the task description
- `synthesis-input.json`, `route.json`, and `file-manifest.json` from `${CONTEXT_PACK_DIR}` when present; otherwise the assembled `<injected-context>` block from Step 3.5 (with `agent="arbiter-review"`)
- All agent outputs
- All Aegis outputs from Step 4.5
- The routing note from Step 0.5, including telemetry hints when present
- The file list
- Working directory: {cwd}
- Instructions to read any files flagged by multiple reviewers that are NOT already in `<injected-context>`

### Arbiter under chunking

If `CHUNKED=true`, Arbiter receives outputs grouped by chunk, with explicit cross-chunk synthesis instructions:

```
=== CHUNKED REVIEW ===
This review covered {FILE_COUNT} files split into {TOTAL_CHUNKS} chunks. For each chunk you have all reviewer outputs keyed by chunk label.

Your synthesis task has two passes:

Pass 1 — Per-chunk verdict. For each chunk, produce a sub-verdict (APPROVE / REVISE / BLOCK) using the usual process. Present these as "Chunk <label>: <verdict> — <1-line summary>".

Pass 2 — Cross-chunk pattern detection. Look for:
  - Findings that repeat across 3+ chunks (systemic issue, promote to BLOCKER regardless of per-chunk severity)
  - Findings in one chunk whose root cause is in another (e.g., API chunk flags a missing field; web chunk shows the consumer assuming it exists)
  - Architectural drift — chunks deviating from each other on naming, error handling, or data-shape conventions

Output your FINAL verdict based on the cross-chunk view. A single chunk with a BLOCKER blocks the whole review. A systemic pattern across chunks is more severe than an isolated one.

=== CHUNK OUTPUTS ===
<one block per chunk, each containing the chunk's Smith/Warden/Lumen/Atlas outputs>
```

If `CHUNKED=false`, Arbiter's input is the existing non-chunked format.

## Step 6: Spawn Compass (Final Review)

After Arbiter completes, spawn `compass-review` with:
- Arbiter's consolidated verdict
- All agent review outputs
- The plan from `.forgeflow/<project-name>/current-plan.md` (if it exists)
- The discussion from `.forgeflow/<project-name>/current-discussion.md` (if it exists)
- The research from `.forgeflow/<project-name>/current-research.md` (if it exists)
- The implementation notes from `.forgeflow/<project-name>/implementation-notes.md` (if it exists)
- The project learnings from `.forgeflow/<project-name>/project-learnings.md` (if it exists, guidance only)
- Any test files she created during `/implement` (check test directories for her `.spec.ts` files or validation checklists)

Compass's prompt:
```
Use the Forgeflow context packet and synthesis input first. Do not re-read packeted files unless exact source evidence is needed for validation.

{synthesis-input.json + relevant phase artifacts when context pack exists, otherwise injected-context block from Step 3.5 with agent="compass-review"}

You are performing your final review after Arbiter's technical verdict.
This includes E2E feature validation and pressure testing — not just code review.

=== NANDO — Consolidated Review ===
{arbiter_output}

=== AGENT REVIEWS (for reference) ===
Smith: {smith_output}
Warden: {warden_output}
Lumen: {lumen_output}
Atlas: {atlas_output}

{If plan exists:}
=== EMILY — Implementation Plan (from /plan phase) ===
{plan_content}

{If discussion exists:}
=== EMILY — Discussion Summary (from /discuss phase) ===
{discussion_content}

{If research exists:}
=== EMILY — Research Findings (from /research phase) ===
{research_content}

Changed files: {file_list}
Working directory: {cwd}
Atlas persistent context: {FORGEFLOW_DIR}/
Note: read {FORGEFLOW_DIR}/agent-notes/ to surface prior learnings from Atlas's persistent memory.

Perform your final review:
1. Run any automated validation tests you created during /implement
   (Playwright, Jest, etc.). Report pass/fail with evidence.
2. Walk through your manual validation checklists against the actual
   implementation. Report pass/fail per item.
3. Execute your pressure test scenarios. Document observed behavior.
4. Check plan adherence, research alignment, requirements coverage,
   accessibility compliance, and UX intent.
5. Deliver your CONFIRM or CHALLENGE verdict. Test failures carry the
   same weight as plan adherence issues — failing tests mean CHALLENGE.

If no tests were created during /implement, design and run validation
checks now based on the changed files and any available plan/criteria.

If no plan/discussion/research exists, note this gap and provide a
lighter-touch review focused on accessibility, UX intent, and
feature-level validation of the changed code.

CI MODE (CLAUDE_CODE_HEADLESS=1):
In CI mode you operate without a dev server or browser. Skip all
steps requiring runtime execution (Playwright, curl against localhost,
axe-core against live DOM). Perform STATIC validation only:
- Read test files in the diff; verify they match the plan's intent
- Check plan adherence, research alignment, requirements coverage
- Flag accessibility markup issues visible in JSX/HTML source
- Report any skipped checks as compass.tests_run: false with a one-line
  "ci-mode: <reason>" note, so the wrapper can surface the gap in the
  PR comment. Do not emit CHALLENGE purely because tests were skipped
  — CHALLENGE requires a static issue you can cite.
```

Compass runs E2E tests, pressure tests features, checks plan adherence, research alignment, requirements coverage, accessibility compliance, and UX intent. Test failures are findings that factor into her CONFIRM or CHALLENGE verdict.

## Step 7: Present verdict

When `CI_MODE=true`, skip the markdown branches below and jump to Step 7.5.

Display Arbiter's consolidated review followed by Compass's final review.

**If Arbiter APPROVE + Compass CONFIRM:**
```
## Forgeflow: APPROVED

{editCount} file(s) passed review.
Compass confirms plan adherence and accessibility compliance.
Proceed with confidence.
```

**If Arbiter APPROVE + Compass CHALLENGE:**
```
## Forgeflow: APPROVED (with challenges)

{Arbiter's approval}

### Compass's Challenges
{Compass's items for consideration}

Address Compass's challenges or acknowledge them, then proceed.
```

**If Arbiter REVISE:**
```
## Forgeflow: REVISE

{Arbiter's required changes}
{Compass's plan adherence notes, if applicable}

Fix the items above, then re-run: /review
```

**Auto-handoff on REVISE or BLOCK:**
After presenting a REVISE or BLOCK verdict, if ANY of the following are true, invoke `/handoff "<branch-name> — review REVISE"` before returning control to the user:
- Session has already burned significant context (subjective self-assessment — if in doubt, write the handoff)
- Arbiter's verdict includes 3 or more BLOCKER or MUST-FIX items
- Compass's verdict is CHALLENGE in addition to Arbiter REVISE
- Any blocker references a file not yet opened in this session (high cost to resume without a handoff)

This prevents the recurring pattern where context exhaustion hits between a REVISE verdict and the next session, forcing the user to reconstruct context from scratch. The Forgeflow team itself captures the blocker list while it is still fresh.

**If Arbiter BLOCK:**
```
## Forgeflow: BLOCKED

{Arbiter's blockers}
{Compass's accessibility/plan blockers, if applicable}

Resolve blockers before proceeding. Then re-run: /review
```

## Step 7.5: CI JSON emission

Executed ONLY when `CI_MODE=true`. Produces a single JSON block wrapped in sentinel tags, per `docs/forgeflow-json-schema.md`. This is the final output to stdout — nothing may follow it.

### 7.5a. Assemble the object

Build a JSON object with every field from the v1 schema populated. Key derivations:

```
verdict = combineVerdicts(arbiter.verdict, compass?.verdict)
  // APPROVE if Arbiter APPROVE + Compass CONFIRM (or Compass skipped in thin-mode)
  // CONDITIONAL_APPROVE if Arbiter CONDITIONAL APPROVE with open blocked findings
  // REVISE if Arbiter REVISE OR Compass CHALLENGE
  // BLOCK if Arbiter BLOCK
  // SKIPPED if Step 0.5 returned skip-mode, or Step 1 had no files
  // ABORTED if any Step 0 gate failed or budget was exceeded

routing_override =
  "user-mode"  if --mode flag was set
  "ci-cap"     if CI cap downgraded full-mode to thin-mode
  null         otherwise

compass = null when routing_mode == "skip-mode" OR verdict == "ABORTED"
  // Compass runs in thin, full, and deep modes — she always follows Arbiter.
  // Only a full skip or an aborted pre-flight omits her.
```

### 7.5a.1. Findings parsing rules (authoritative)

The orchestrator parses Arbiter's consolidated review (Step 5 output) into the schema's `findings` object. Arbiter's review follows the section template defined in `agents/arbiter-review.md`:

```
## Blockers (must fix before testing)
## Must Fix (before merge)
## Recommended Improvements (should do)
## Boyscout Fixes (pre-existing issues found)
## Highlights (things done well)
```

Parsing contract:

1. **Section to tier mapping:**
   - `## Blockers (must fix before testing)` → `findings.blockers`
   - `## Must Fix (before merge)` → `findings.must_fix`
   - `## Recommended Improvements (should do)` → `findings.recommended`
   - `## Boyscout Fixes (pre-existing issues found)` → `findings.boyscout`
   - There is no "Nits" section in arbiter-review template today; `findings.nits` stays empty unless a future template adds it.

2. **Per-finding extraction.** Each top-level bullet under a tier section is one finding. For each bullet:
   - `title` — first line up to 80 chars (truncate at sentence boundary when possible)
   - `detail` — full bullet text (leading `- ` stripped; sub-bullets joined with newlines)
   - `file` + `line` — extracted via regex `([a-zA-Z0-9_./-]+):(\d+)` matching the first occurrence in the bullet. Null when not present.
   - `raised_by` — `"arbiter"` by default (Arbiter's synthesis). If the bullet contains `"[Smith]"`, `"[Warden]"`, `"[Lumen]"`, `"[Atlas]"` citation, use that reviewer's canonical name.
   - `class` — null unless the bullet text contains a recognizable tag from the overturn class vocabulary (`n-plus-one`, `null-safety`, `sql-injection`, etc.). Pattern recognition is best-effort; null is acceptable.
   - `severity` — matches the tier name.
   - `id` — assigned sequentially by the orchestrator within a run: `B1`, `B2`... for blockers, `M1`... for must-fix, `R1`... for recommended, `BS1`... for boyscout.

3. **Parse warnings.** If a section heading is present but bullet extraction produces zero findings (Arbiter used free-form prose instead of bulleted items), record a parse warning in `metadata.parse_warnings` (array of strings) and emit an empty array for that tier. Never fabricate findings.

4. **Schema v1 guarantee.** `findings.<tier>` is always an array (possibly empty). The consumer (CI wrapper, dashboard) can iterate without null checks.

### 7.5a.2. Remaining fields

```
overturned_findings = parsed from Arbiter's "## Overturned Findings (telemetry)" block
  // Same format contract as the forgeflow-telemetry.js hook regex.
  // Empty array when Arbiter overturned nothing.

chunking.chunked = (CHUNKED == true)
chunking.chunks = [{label, file_count, routing_mode, verdict}, ...]  when chunked
chunking.strategy = "monorepo" | "path-segment" | null

files_reviewed = Step 1's resolved file list
metadata.cost_estimate_usd = sum(model_rate_per_mtok * tokens_used_per_agent)
  // Use rough token estimate per routing mode when pre-estimating;
  // use actual dispatch token counts when available post-hoc.
metadata.parse_warnings = [] | ["Arbiter Blockers section had no bulleted items", ...]
  // Only populated when parsing could not extract structured findings.
```

### 7.5b. ABORTED path

When Step 0 pre-flight failed, Step 0.5 returned `skip-mode`, or Step 1 produced no files, the flow jumps directly here without spawning reviewers. Fill the envelope per the schema's SKIPPED / ABORTED shape:

```json
{
  "schema_version": "1",
  "verdict": "ABORTED",
  "summary": "<one-line reason>",
  "routing_mode": "<mode-or-null>",
  ...
  "reason": "<fixed enum value from schema>"
}
```

`reason` uses the fixed enum in the schema doc (`classifier-skip-mode`, `no-files-changed`, `preflight-typecheck-failed`, `preflight-lint-failed`, `preflight-branch-mismatch`, `budget-exceeded`, `auth-missing`, `classifier-error`).

### 7.5c. Emit

Print the JSON object wrapped in sentinel tags as the LAST output to stdout. Nothing may follow:

```
<forgeflow-verdict-json>
{
  "schema_version": "1",
  "verdict": "APPROVE",
  ...
}
</forgeflow-verdict-json>
```

The wrapper script greps for the sentinel block; anything before it is log output, anything after is forbidden.

### 7.5d. Exit code

After emission, exit with the code from the schema's `verdict` → exit code mapping:
- `APPROVE` / `CONDITIONAL_APPROVE` / `SKIPPED` → exit 0
- `REVISE` / `BLOCK` → exit 1
- `ABORTED` → exit 2

## Step 8: Mark review complete

The auto-fire hook automatically detects review completion. When the hook sees Compass's final verdict (CONFIRM or CHALLENGE), it sets `reviewRun: true` in the session state file, suppressing further advisories for this session.

No manual debounce step is needed -- the hook manages its own state using `data.session_id` from Claude Code's JSON input.

</process>

<success_criteria>
- [ ] Changed files identified from git or arguments
- [ ] Smith, Warden, Lumen, Atlas spawned in parallel
- [ ] All agents completed reviews
- [ ] Arbiter synthesized technical verdict
- [ ] Compass ran E2E validation tests (automated and/or manual)
- [ ] Compass executed pressure test scenarios
- [ ] Compass verified plan adherence, accessibility, and UX intent
- [ ] Test results included in Compass's verdict
- [ ] Atlas persisted learnings to .forgeflow/
- [ ] Combined verdict presented with clear next steps
</success_criteria>
