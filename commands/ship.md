---
name: ship
description: Generate stakeholder presentation, create PR, and monitor CI with automatic failure resolution
argument-hint: "[PR title or description]"
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
  source "$FORGEFLOW_INIT_SESSION" "ship" "$*"
else
  CHAT_AVAILABLE=false
  CHAT_SEND=""
  ROOM_NAME="ship"
  export CHAT_AVAILABLE CHAT_SEND ROOM_NAME
fi
```
<objective>
Ship the current branch. This is the final command in the lifecycle: `/discuss` -> `/research` -> `/plan` -> `/consult` -> `/implement` -> `/review` -> `/ship`. It generates a stakeholder presentation (HTML), creates or updates a pull request, monitors CI, and auto-fixes failures.

**Prerequisite:** The Forgeflow must have passed this branch. `/ship` checks `review-history.md` for a passing review verdict (`APPROVE + CONFIRM` or an allowed `CONDITIONAL APPROVE`) and refuses to proceed without it.

**Permission grant:** The user invoked /ship, which grants permission to push, create PRs, and auto-fix CI failures. This overrides the global CLAUDE.md restriction on git push and gh commands for the scope of this execution.
</objective>

<context>
$ARGUMENTS -- Optional PR title or description. If empty, Compass infers a headline from commit history and changed file context.

Flags:
- `--skip-hygiene`: Bypass Step 1g commit hygiene validation (use only when you have a justification)
- `--stale-ok`: Bypass the stale-review check in Step 1b.1 when HEAD has advanced beyond reviewed commits

Derive project paths:
```bash
PROJECT_NAME=$(basename "$(pwd)")
FORGEFLOW_DIR=".forgeflow/${PROJECT_NAME}"
NOTES_PATH="${FORGEFLOW_DIR}/implementation-notes.md"
PROJECT_LEARNINGS_PATH="${FORGEFLOW_DIR}/project-learnings.md"
LEAN_DECISION_JSON_PATH="${FORGEFLOW_DIR}/context/lean-decision.json"
LEAN_REPORT_JSON_PATH="${FORGEFLOW_DIR}/context/lean-report.json"
```
</context>

<process>

## Step 1: Gather Context + Gate Check

### 1a. Derive paths
```bash
PROJECT_NAME=$(basename "$(pwd)")
FORGEFLOW_DIR=".forgeflow/${PROJECT_NAME}"
BASE_BRANCH=$(git remote show origin 2>/dev/null | grep 'HEAD branch' | awk '{print $NF}' || echo "main")
```
Use `${BASE_BRANCH}` everywhere a base branch reference is needed (git log, git diff, etc.).

### 1b. Review gate
Read `${FORGEFLOW_DIR}/review-history.md` and parse for the latest verdict.

- If the file does not exist, exit immediately:
  "Review not passed. Run `/review` first to get Forgeflow approval."
- If the latest verdict is not a passing review verdict (`APPROVE + CONFIRM` or an allowed `CONDITIONAL APPROVE`), exit immediately:
  "Review not passed. Run `/review` first to get Forgeflow approval."

Do NOT proceed past this step without a passing verdict.

### 1b.1 Branch assertion
Verify the current branch matches the expected PR context:
```bash
CURRENT_BRANCH=$(git branch --show-current)
PR_BRANCH=$(gh pr view --json headRefName -q .headRefName 2>/dev/null || echo "")
```

If `PR_BRANCH` is non-empty AND does not equal `CURRENT_BRANCH`, exit immediately:
```
Branch mismatch: currently on '<current>', linked PR expects '<expected>'.
/ship will not proceed from the wrong branch. Switch branches or clarify intent.
```

Also verify the latest review in `review-history.md` references the same branch or commit range as the current HEAD. If the review is stale (HEAD has advanced beyond what was reviewed), emit a warning and require explicit `--stale-ok` override in $ARGUMENTS to proceed.

### 1c. Gather git context
```bash
# Commit history for the branch
git log ${BASE_BRANCH}..HEAD --oneline

# Files changed summary (goes to Compass -- compact form)
git diff ${BASE_BRANCH} --stat

# Full diff (goes to Atlas and screenshot agent ONLY -- NOT Compass)
git diff ${BASE_BRANCH}
```

### 1d. Load Forgeflow artifacts (if they exist)
Read each of these if present -- do not fail if missing:
- `${FORGEFLOW_DIR}/current-plan.md`
- `${FORGEFLOW_DIR}/current-discussion.md`
- `${FORGEFLOW_DIR}/current-research.md`
- `${FORGEFLOW_DIR}/current-brief.md`
- `${FORGEFLOW_DIR}/implementation-notes.md`
- `${FORGEFLOW_DIR}/project-learnings.md`

Also check for `CONTEXT.md` in the working directory. If it exists, read it and pass to Compass and Atlas — it provides service-specific context that improves presentation quality.

### 1d.0 Lean readiness advisory

If `${LEAN_DECISION_JSON_PATH}` exists, check whether `${LEAN_REPORT_JSON_PATH}` exists and whether `${NOTES_PATH}` contains a lean ceiling or upgrade trigger phrase such as `Lean path selected`, `Known ceiling`, or `Upgrade trigger`.

- If the lean decision exists and either the report or ceiling evidence is missing, print a warning and continue:
  "Lean readiness warning: lean decision exists, but lean report or ceiling evidence is missing. Run `/forgeflow-lean-report --write` or record the ceiling before relying on lean metrics."
- This is advisory only. It must not bypass or fail the review gate, push, PR creation, or CI follow-up by itself.

### 1d.1 Implementation notes quality check
Resolve the helper directory before running release-gated checks:

```bash
HELPER_DIR="scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/check-implementation-notes.js" ] && [ -f "$HOME/.claude/forgeflow/scripts/forgeflow/check-implementation-notes.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
```

If `${HELPER_DIR}/check-implementation-notes.js` is missing, stop with:

```text
Implementation notes helper is not installed. Run /update-forgeflow --repair, then retry /ship.
```

If `${HELPER_DIR}/check-implementation-notes.js` is available, run:

```bash
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/check-implementation-notes.js" --project-dir "${FORGEFLOW_DIR}" --json
```

Treat `warn` as a visible ship note, not a blocker. Treat `fail` as a hard stop because it means sensitive content or another release-blocking notes problem was detected. Include the checker status in the PR body and ship artifacts when using `ship-prepare.sh`.

### 1d.2 Project learnings refresh
If `${HELPER_DIR}/show-project-learnings.js` is available, run it before preparing the PR body:

```bash
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/show-project-learnings.js" --project-dir "${FORGEFLOW_DIR}" --json
```

Treat the refreshed project learnings as local guidance only. Include the artifact path in the ship handoff, but do not claim any learning as current evidence unless it is verified against the current code, tests, and review artifacts.

### 1e. Detect frontend files
Check `git diff ${BASE_BRANCH} --name-only` for frontend files. Frontend detection (same as /review):
files in `frontend/`, `src/components/`, `src/pages/`, `public/`, or with extensions `.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss`, `.html`.

Set `HAS_FRONTEND=true` if any frontend files are present.

### 1f. Secret scan (hard gate)
Scan the full diff for obvious secret patterns:
- `password=`, `api_key=`, `secret=`, `token=` (case-insensitive, in assignment context)
- Base64 strings longer than 40 characters inside `.env` files
- AWS key patterns (`AKIA[A-Z0-9]{16}`)
- Private key headers (`-----BEGIN .* PRIVATE KEY-----`)

If any matches are found, exit immediately:
```
Potential secrets detected in diff:
  - [file:line] [pattern matched]

Remove or redact the matched content, rerun validation, then rerun /ship.
```

Do not prompt to continue and do not ship with potential secrets in the diff.

### 1g. Commit hygiene validation

Enforce Forgeflow commit hygiene rules as the last gate before PR creation unless `$ARGUMENTS` contains `--skip-hygiene`. Do not depend on a `CLAUDE.md` opt-in.

Run these checks:

**Commit body line length (hard gate):**
```bash
# Find any commit body line longer than 72 chars since base branch
git log ${BASE_BRANCH}..HEAD --format="%b" | awk 'length > 72 {print NR": "$0}'
```
If any long lines are found, STOP with:
```
Commit body lines exceed 72 characters. Pre-commit hook on many repos will reject these.
Lines over limit:
  <line number>: <excerpt>

Options:
1. Interactive rebase to rewrite the offending commit messages
2. Squash via `git reset --soft ${BASE_BRANCH} && git commit` with wrapped message
3. Override: re-run /ship with --skip-hygiene
```

**Prettier final pass (soft gate):**
```bash
# Verify all changed files pass prettier
git diff ${BASE_BRANCH} --name-only | xargs pnpm prettier --check 2>&1 | tail -20
```
If any files fail prettier, emit a warning (not a block) and offer to auto-fix:
```
Prettier would reformat <n> file(s). Auto-fix now?
```
If yes, run `prettier --write`, re-stage, create an amend-style fix-up commit (not `--amend`, a new commit).

**Stale imports scan (advisory only):**
```bash
# Files with removed exports (detected via git diff deletions of `export ` lines)
git diff ${BASE_BRANCH} -- '*.ts' '*.tsx' '*.js' '*.jsx' | grep "^-export " | head -20
```
For each removed export name, grep the tree for surviving `import` references:
```bash
grep -rn "import.*\b<exported-name>\b" src/ --include="*.ts" --include="*.tsx"
```
If consumers exist but the export was removed, emit a WARNING listing them. Let the user decide — do not block.

**Secret patterns check (cross-reference 1f):**
This step is already covered by 1f. Re-run the scan if any files changed during hygiene fixes; any match remains a hard stop.

**Fail-open default:** If non-secret hygiene checks such as `git log` or `git diff` error out (e.g., shallow clone, detached HEAD), log the error and continue. Secret-scan failures must never fail open.


## Step 2: Phase 1 -- Parallel Content Generation

Spawn three agents in parallel using the Agent tool. All three run simultaneously.

### Agent 1 -- Compass (present mode)

- **subagent_type:** `compass-present`
- **Prompt includes:**
  - `git log ${BASE_BRANCH}..HEAD --oneline` output
  - `git diff ${BASE_BRANCH} --stat` output (compact file summary ONLY -- do NOT include full diff)
  - `$ARGUMENTS` if provided by the user
  - Plan, discussion, and research artifacts if they exist
- **Instruction:**

```
You are operating in **present mode**.

Your job: produce a stakeholder-facing summary of this release. Write for product managers,
designers, and executives -- zero jargon, zero implementation details.

Context:
- Commit history: {git_log}
- Files changed: {git_diff_stat}
- User description: {arguments_or_empty}
{If plan exists:}
- Implementation plan: {plan_content}
{If discussion exists:}
- Discussion summary: {discussion_content}
{If research exists:}
- Research findings: {research_content}

Produce ONLY valid JSON matching this exact schema. No markdown, no explanation, no preamble.
Just the JSON object:

{
  "headline": "A concise, compelling release title (max 80 chars). Written for humans, not developers.",
  "summary": "2-4 sentences explaining what changed and why it matters to users. No technical terms.",
  "capabilities": [
    {
      "title": "Short capability name",
      "description": "What this enables for users, in plain language.",
      "type": "new|enhanced|fixed"
    }
  ],
  "before_after": [
    {
      "area": "Name of the area that changed",
      "before": "How it worked before (user perspective)",
      "after": "How it works now (user perspective)"
    }
  ],
  "impact": "1-2 sentences on the business or user impact. Quantify if possible.",
  "accessibility_notes": "Any accessibility improvements. Empty string if none."
}

Rules:
- "capabilities" must have at least 1 entry. Derive from commits and file changes.
- "before_after" can be empty array if changes are entirely new (no prior behavior to compare).
- "type" must be exactly one of: "new", "enhanced", "fixed".
- If you cannot determine accessibility changes, set "accessibility_notes" to "".
- Do NOT include file paths, function names, or technical details anywhere.
```

### Agent 2 -- Atlas (present mode)

- **subagent_type:** `atlas-present`
- **Prompt includes:**
  - `git log ${BASE_BRANCH}..HEAD --oneline` output
  - `git diff ${BASE_BRANCH}` output (FULL diff)
  - `git diff ${BASE_BRANCH} --stat` output
  - Plan, discussion, research, and brief artifacts if they exist
  - Implementation notes artifact if it exists
  - FORGEFLOW_DIR path
- **Instruction:**

```
You are operating in **present mode**.

Your job: produce the developer-facing section of the ship presentation. This is for engineers
reviewing the PR and for the team's technical record.

Context:
- Commit history: {git_log}
- Full diff: {git_diff}
- File summary: {git_diff_stat}
- FORGEFLOW_DIR: {forgeflow_dir}
{If plan exists:}
- Implementation plan: {plan_content}
{If discussion exists:}
- Discussion summary: {discussion_content}
{If research exists:}
- Research findings: {research_content}
{If brief exists:}
- Implementation brief: {brief_content}
{If implementation notes exist:}
- Implementation notes: {implementation_notes_content}

Also read ${FORGEFLOW_DIR}/review-history.md to extract the review verdict details. Summarize implementation notes into decisions, spec gaps, tradeoffs, deviations, follow-ups, and validation notes; do not dump raw notes or include secrets.

Produce ONLY valid JSON matching this exact schema. No markdown, no explanation, no preamble.
Just the JSON object:

{
  "files_changed": {
    "added": ["path/to/new-file.ts"],
    "modified": ["path/to/changed-file.ts"],
    "deleted": ["path/to/removed-file.ts"]
  },
  "testing": {
    "summary": "Brief description of test coverage.",
    "results": [
      { "suite": "Unit tests", "passed": 0, "failed": 0 },
      { "suite": "Integration tests", "passed": 0, "failed": 0 }
    ]
  },
  "architecture_notes": "1-3 sentences on significant architectural decisions or patterns used.",
  "implementation_notes": {
    "decisions": ["Notable implementation decision in plain engineering language."],
    "spec_gaps": ["Spec gap or ambiguous requirement resolved during implementation."],
    "tradeoffs": ["Tradeoff made and why."],
    "deviations": ["Approved deviation from the plan or brief."],
    "follow_ups": ["Follow-up the team should know about."],
    "validation_notes": ["Validation detail that matters for handoff."]
  },
  "risks_mitigated": ["Each risk as a complete sentence describing the risk and how it was addressed."],
  "learnings": ["Noteworthy things the team should remember from this implementation."],
  "review_verdict": {
    "arbiter": "APPROVE|REVISE|BLOCK",
    "compass": "CONFIRM|CHALLENGE",
    "blockers_resolved": 0,
    "highlights": ["Key positive callouts from the review."]
  },
  "branch": "feature/branch-name",
  "base": "main"
}

Rules:
- "files_changed" must be derived from the actual diff, not guessed.
- For "testing", run test commands if a test runner is configured (check package.json scripts).
  If tests cannot be run, provide best-effort estimates from test file analysis. Set counts to 0
  if unknown, and note this in "summary".
- "branch" must come from: git branch --show-current
- "base" should match `${BASE_BRANCH}` -- verify with: git rev-parse --verify ${BASE_BRANCH} 2>/dev/null
- "review_verdict" must be parsed from review-history.md, not fabricated.
- "implementation_notes" must be summarized from `${NOTES_PATH}` when present. Use empty arrays when no notes exist.
```

### Agent 3 -- Screenshot Agent (conditional -- only if HAS_FRONTEND is true)

- **No subagent_type** (general-purpose agent)
- **Prompt includes:**
  - Full diff
  - List of changed frontend files
- **Instruction:**

```
You are capturing screenshots of UI changes for a release presentation.

Changed frontend files:
{frontend_files_list}

Execute a three-tier capture strategy. Try each tier in order -- use the highest tier you can achieve.

### Tier 1: Playwright Automated Capture
1. Check if a dev server is running or can be started:
   - Look for package.json scripts: "dev", "start", "serve"
   - Check if port 3000/5173/8080 is already listening: lsof -i :3000 -t 2>/dev/null
   - If not running, attempt to start in background and wait up to 15 seconds
2. Infer routes from changed files:
   - src/pages/Foo.tsx -> /foo
   - src/components/Bar.tsx -> check for route imports or use /
3. Capture at 1280x720 using Playwright:
   ```bash
   npx playwright screenshot --viewport-size="1280,720" <url> <output.png>
   ```
   Or write a minimal Playwright script if the CLI screenshot command is not available.
4. Read each screenshot file and convert to base64.

### Tier 2: Existing E2E Artifacts
If Tier 1 fails (no dev server, Playwright not installed, etc.):
1. Search for existing screenshot artifacts:
   - test-results/**/*.png
   - playwright-report/**/*.png
   - screenshots/**/*.png
   - e2e/**/*.png
2. Pick the most relevant ones based on changed file names.
3. Read and convert to base64.

### Tier 3: Manual Fallback
If Tiers 1 and 2 both fail:
1. Create placeholder entries describing what should be captured.
2. These will render as placeholder boxes in the presentation.

Produce ONLY valid JSON matching this exact schema:

{
  "screenshots": [
    {
      "label": "Description of what this shows",
      "base64": "base64-encoded-png-data",
      "route": "/route-captured",
      "tier": 1
    }
  ],
  "placeholders": [
    {
      "label": "What should be captured",
      "description": "Why it could not be captured automatically"
    }
  ]
}

Rules:
- "screenshots" contains successfully captured images. "placeholders" contains fallbacks.
- Never include both a screenshot and a placeholder for the same view.
- If Tier 1 succeeds for some routes but not others, mix screenshots and placeholders.
- base64 strings must be raw base64 (no data: prefix -- that gets added during HTML assembly).
- Maximum 6 screenshots. Prioritize routes that correspond to changed files.
```


## Step 3: Phase 2 -- HTML Assembly

After all agents from Step 2 complete:

### 3a. Parse agent outputs
Parse the JSON from Compass (Agent 1) and Atlas (Agent 2). If the screenshot agent ran (Agent 3), parse that too. If any agent returned invalid JSON, attempt to extract the JSON from their response (look for `{...}` blocks). If extraction fails, use sensible defaults:
- Compass fallback: headline from first commit message, empty summary/capabilities
- Atlas fallback: files from git diff --stat, empty testing/architecture
- Screenshots fallback: all placeholders

### 3b. Read the HTML template
```bash
cat ~/.claude/templates/ship-presentation.html
```
Use the template's `<style>` block verbatim -- copy every CSS rule exactly as defined. Use the template's HTML structure as the reference for section ordering and class names.

### 3c. Build the HTML document
**HTML escaping rule:** Before inserting ANY dynamic string value from agent JSON into HTML, escape these characters: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`. This applies to all text content (headlines, descriptions, file paths, architecture notes, etc.).

Construct the final HTML file section by section:

1. **DOCTYPE, head, and style:** Copy the template's complete `<head>` including all CSS.
   Update `<title>` to include Compass's headline.

2. **Header section:**
   - `.release-label`: "Release Summary"
   - `.headline`: Compass's `headline`
   - `.meta`: PR placeholder (will be patched in Step 4), today's date, branch flow from Atlas's `branch` + `base`

3. **Summary section:** Compass's `summary`

4. **Capabilities section:** Map Compass's `capabilities` array to `.capability` items.
   Map `type` to badge class: `new` -> `badge-new`, `enhanced` -> `badge-enhanced`, `fixed` -> `badge-fixed`.

5. **Before/After section:** (OMIT if Compass's `before_after` is empty array)
   Map each entry to a `.before-after-area` + `.before-after-row`.

6. **Screenshots section:** (OMIT if no screenshots AND no placeholders)
   - Real screenshots: `<img src="data:image/png;base64,{base64}" alt="{label}" style="width:100%;border-radius:8px;">`
   - Placeholders: `<div class="screenshot-placeholder">{label}</div>`

7. **Impact section:** Compass's `impact`

8. **Accessibility section:** (OMIT if Compass's `accessibility_notes` is empty string)
   Compass's `accessibility_notes`

9. **Developer divider:** The `.divider` section exactly as in template.

10. **Files Changed section:** Map Atlas's `files_changed` to `.file-list` items.
    `added` -> `file-added`, `modified` -> `file-modified`, `deleted` -> `file-deleted`.

11. **Test Results section:** Atlas's `testing.summary` as `.test-summary`, then
    `testing.results` as `.test-table` rows.

12. **Architecture Notes section:** Atlas's `architecture_notes`

13. **Risks Mitigated section:** (OMIT if `risks_mitigated` is empty)
    Map to `.risk-list` items.

14. **Implementation Notes section:** (OMIT if all `implementation_notes` arrays are empty)
    Render compact grouped lists for decisions, spec gaps, tradeoffs, deviations, follow-ups, and validation notes. Do not render the raw markdown log.

15. **Learnings section:** (OMIT if `learnings` is empty)
    Map Atlas's `learnings` array to a `.risk-list` styled list (reuse same styling).
    Section title: "Session Learnings".

16. **Review Verdict section:** Atlas's `review_verdict` rendered as `.verdict-card`.
    - Arbiter row with verdict badge
    - Compass row with verdict badge
    - Blockers resolved count
    - Highlights as `.verdict-highlights` items

16. **Close container, body, html.**

### 3d. Conditional section omission
Do NOT render sections where data is empty:
- No `before_after` entries -> skip Before & After section entirely
- Empty `accessibility_notes` -> skip Accessibility section entirely
- No screenshots AND no placeholders -> skip Screenshots section entirely
- Empty `risks_mitigated` -> skip Risks Mitigated section entirely

### 3e. Write the presentation file
```bash
mkdir -p "${FORGEFLOW_DIR}/presentations"
```

Generate filename: `<date>-<slug>.html`
- Date: `$(date +%Y-%m-%d)`
- Slug: Compass's headline, lowercased, spaces to hyphens, non-alphanumeric (except hyphens) removed, truncated to 40 chars
- Example: `2026-03-19-campaign-email-scheduling-with.html`

Write the assembled HTML to `${FORGEFLOW_DIR}/presentations/<date>-<slug>.html`.


## Step 4: PR Creation

### 4a. Safety check -- never ship from main/master
```bash
BRANCH=$(git branch --show-current)
if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
  echo "ERROR: Cannot /ship from main/master branch"
  exit 1
fi
```

If on main/master, stop execution entirely with:
"Cannot /ship from main/master. Create a feature branch first."

### 4b. Ensure branch is pushed
```bash
git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || git push -u origin HEAD
```

If the branch has no upstream, push it. If it already has an upstream, ensure latest commits are pushed:
```bash
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse @{u} 2>/dev/null)
if [ "$LOCAL" != "$REMOTE" ]; then
  git push
fi
```

### 4c. Check for existing PR
```bash
gh pr view --json number,url 2>/dev/null
```

### 4d. Create or update PR

**If no existing PR:** Create one.
```bash
gh pr create --title "{compass_headline}" --body "$(cat <<'EOF'
## Summary
{compass_summary}

## Capabilities
{capabilities_as_bullet_list}

## Test Results
{cory_testing_summary}

## Review Verdict
- Arbiter: {verdict}
- Compass: {verdict}
- Blockers resolved: {count}

---
*Generated with Claude Code + Forgeflow*
*Presentation: .forgeflow/{project}/presentations/{filename}*
EOF
)"
```

**If PR exists:** Update the body.
```bash
gh pr edit {pr_number} --title "{compass_headline}" --body "$(cat <<'EOF'
{same body format as above}
EOF
)"
```

### 4e. Capture PR details
Store the PR number and URL from the create/edit output.

### 4f. Patch the HTML presentation
Replace the PR placeholder text in the HTML file with the actual PR number and URL:
- Replace `PR #...` with `PR #{number}` (or make it a link if the URL is available)
- Use the Edit tool to perform this replacement in the presentation HTML file.


## Step 5: CI Monitoring (Hybrid)

### 5a. Inline polling
Wait for CI checks to complete using inline polling:

1. **First poll after 60 seconds** (initial polls always return PENDING -- don't waste time).
2. **Subsequent polls every 30 seconds.**
3. **Maximum 10 polls total** (~5 minutes of monitoring after the first poll).

Each poll:
```bash
gh pr checks {pr_number} --json name,state,conclusion
```

Evaluate results:
- **All checks have `conclusion: "success"`** -> Report green CI, proceed to completion.
- **Any check has `conclusion: "failure"`** -> Enter Step 6 (Failure Resolution).
- **Still pending after 10 polls** -> Generate async watcher (Step 5b).

Display poll status to user on each check:
```
CI Check [3/10]: 2 passing, 1 pending, 0 failed
```

### 5b. Async watcher fallback
If checks are still pending after inline polling exhausts, generate a watcher script.

Write to `${FORGEFLOW_DIR}/pr-watcher.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# --- Configuration ---
PR_NUMBER="{pr_number}"
FORGEFLOW_DIR="{forgeflow_dir}"
BASE_BRANCH="{base_branch}"
MAX_ATTEMPTS=30
POLL_INTERVAL=60

# --- Input validation ---
if ! [[ "$PR_NUMBER" =~ ^[0-9]+$ ]]; then
  echo "ERROR: Invalid PR number"
  exit 1
fi

if [[ "$FORGEFLOW_DIR" =~ [;\|&\`\$\(] ]] || [[ "$FORGEFLOW_DIR" =~ $'\n' ]]; then
  echo "ERROR: Invalid directory path"
  exit 1
fi

# --- Dependency check ---
command -v jq >/dev/null || { echo "ERROR: jq is required but not installed"; exit 1; }
command -v gh >/dev/null || { echo "ERROR: gh CLI is required but not installed"; exit 1; }

# --- PID lock ---
PIDFILE="${FORGEFLOW_DIR}/.pr-watcher.pid"
if [ -f "$PIDFILE" ]; then
  OLD_PID=$(cat "$PIDFILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Watcher already running (PID $OLD_PID). Exiting."
    exit 0
  fi
fi
echo $$ > "$PIDFILE"
trap 'rm -f "$PIDFILE"' EXIT

# --- Polling loop ---
echo "Watching PR #${PR_NUMBER} for CI completion..."
echo "Max attempts: ${MAX_ATTEMPTS} | Interval: ${POLL_INTERVAL}s"

for ((i=1; i<=MAX_ATTEMPTS; i++)); do
  CHECKS=$(gh pr checks "$PR_NUMBER" --json name,state,conclusion 2>/dev/null || echo "[]")

  TOTAL=$(echo "$CHECKS" | jq 'length')
  PASSED=$(echo "$CHECKS" | jq '[.[] | select(.conclusion == "success")] | length')
  FAILED=$(echo "$CHECKS" | jq '[.[] | select(.conclusion == "failure")] | length')
  PENDING=$((TOTAL - PASSED - FAILED))

  echo "[${i}/${MAX_ATTEMPTS}] Passed: ${PASSED} | Failed: ${FAILED} | Pending: ${PENDING}"

  if [ "$FAILED" -gt 0 ]; then
    echo "CI FAILED"
    FAILED_CHECKS=$(echo "$CHECKS" | jq -r '.[] | select(.conclusion == "failure") | .name')
    DIFF_FILES=$(git diff ${BASE_BRANCH} --name-only 2>/dev/null || echo "unknown")

    cat > "${FORGEFLOW_DIR}/pr-failure.md" <<FAILEOF
# CI Failure Report
**PR:** #${PR_NUMBER}
**Time:** $(date -Iseconds)

## Failed Checks
${FAILED_CHECKS}

## Changed Files
${DIFF_FILES}

## Suggested Routing
- Type/build/lint errors -> smith-implement
- Test failures -> smith-implement + warden-implement (parallel)
- CI config/security -> warden-implement
- Unknown -> smith-implement + warden-implement (parallel)

## Next Steps
Run the next Claude session in this directory. It will detect pr-failure.md and route to the appropriate agents for auto-fix.
FAILEOF

    echo "Failure report written to ${FORGEFLOW_DIR}/pr-failure.md"
    exit 1
  fi

  if [ "$PENDING" -eq 0 ] && [ "$TOTAL" -gt 0 ]; then
    echo "ALL CI CHECKS PASSED"
    cat > "${FORGEFLOW_DIR}/pr-success.md" <<SUCCESSEOF
# CI Success Report
**PR:** #${PR_NUMBER}
**Time:** $(date -Iseconds)
**Checks passed:** ${PASSED}
SUCCESSEOF

    echo "Success report written to ${FORGEFLOW_DIR}/pr-success.md"
    exit 0
  fi

  sleep "$POLL_INTERVAL"
done

echo "TIMEOUT: CI checks did not complete within $((MAX_ATTEMPTS * POLL_INTERVAL / 60)) minutes"
cat > "${FORGEFLOW_DIR}/pr-timeout.md" <<TIMEOUTEOF
# CI Timeout Report
**PR:** #${PR_NUMBER}
**Time:** $(date -Iseconds)
**Status at timeout:** ${PASSED} passed, ${FAILED} failed, ${PENDING} pending

Check CI status manually: gh pr checks ${PR_NUMBER}
TIMEOUTEOF

echo "Timeout report written to ${FORGEFLOW_DIR}/pr-timeout.md"
exit 2
```

Make it executable:
```bash
chmod +x "${FORGEFLOW_DIR}/pr-watcher.sh"
```

Tell the user:
```
CI checks still running after inline monitoring window.
Watcher script: ${FORGEFLOW_DIR}/pr-watcher.sh

Run it in the background:
  bash ${FORGEFLOW_DIR}/pr-watcher.sh &

If checks fail, the next Claude session will detect pr-failure.md
and route to Smith + Warden for auto-fix.
```


## Step 6: Failure Resolution

Enter this step when CI checks fail -- either detected inline (Step 5a) or from a `pr-failure.md` file.

### 6a. Fetch failure details
```bash
gh pr checks {pr_number} --json name,state,conclusion
```

For each failed check, attempt to get logs:
```bash
gh run view {run_id} --log-failed 2>/dev/null | tail -100
```

### 6b. Classify failures and route to agents

Use this classification table to determine which agent(s) handle each failure:

| Signal Pattern | Route To |
|---|---|
| Type errors (`TS\d+`, `tsc`, `type.*error`) | Smith |
| Build failures (`build failed`, `compilation error`, `esbuild`, `webpack`) | Smith |
| Lint errors (`eslint`, `prettier`, `lint`) | Smith |
| Unit test failures (`FAIL`, `AssertionError`, `jest`, `vitest`) | Smith + Warden (parallel) |
| E2E test failures (`playwright`, `cypress`, `e2e`) | Smith + Warden (parallel) |
| CI config failures (`workflow`, `pipeline`, `docker`, `Dockerfile`) | Warden |
| Security scan failures (`snyk`, `dependabot`, `audit`, `vulnerability`) | Warden |
| Unknown / unclassified | Smith + Warden (parallel) |

### 6c. Spawn fix agents

For each routed agent, spawn with the Agent tool:

**Smith (`smith-implement`):**
```
CI check "{check_name}" failed. Fix the failure.

Failing check logs:
{failure_logs}

PR diff context:
{git_diff_main}

{If brief exists:}
Implementation brief:
{brief_content}

<file-scope>
Fix ONLY the files that appear in the PR diff above. Do not glob, grep, or explore outside
the changed files unless you have a specific unresolved import to trace. If you need an
unlisted file, note it in your output — do not self-expand scope.
</file-scope>

Rules:
- Fix ONLY the CI failure. Do not refactor or change unrelated code.
- Commit the fix atomically with a clear message: "fix: {description of what was fixed}"
- If the fix requires changing more than 10 files or adding more than 200 lines, STOP
  and report back instead of committing. The fix is too large for auto-resolution.
```

**Warden (`warden-implement`):**
```
CI check "{check_name}" failed. Fix the failure.

Failing check logs:
{failure_logs}

PR diff context:
{git_diff_main}

{If brief exists:}
Implementation brief:
{brief_content}

<file-scope>
Fix ONLY the files that appear in the PR diff above. Do not glob, grep, or explore outside
the changed files unless you have a specific unresolved import to trace. If you need an
unlisted file, note it in your output — do not self-expand scope.
</file-scope>

Rules:
- Fix ONLY the CI failure. Do not refactor or change unrelated code.
- Commit the fix atomically with a clear message: "fix: {description of what was fixed}"
- If the fix requires changing more than 10 files or adding more than 200 lines, STOP
  and report back instead of committing. The fix is too large for auto-resolution.
```

### 6d. Push fix and re-monitor

After fix agents complete:

1. **Diff size guard:** Check the fix commit.
   ```bash
   FILES_CHANGED=$(git diff HEAD~1 --name-only | wc -l)
   LINES_ADDED=$(git diff HEAD~1 --stat | tail -1 | grep -Eo '[0-9]+ insertion' | grep -Eo '[0-9]+')
   ```
   If >10 files changed or >200 lines added, do NOT push. Surface to user:
   "Fix commit is unusually large ({files} files, {lines} lines). Review before pushing."

2. **Push the fix:**
   ```bash
   git push
   ```

3. **Increment push cycle counter.** Track how many fix-push cycles have occurred.

4. **If push cycle count >= 3:** Stop auto-fixing. Surface to user:
   "CI still failing after 3 fix attempts. Manual intervention needed."
   List the remaining failures and what was attempted.

5. **If push cycle count < 3:** Re-enter Step 5a (inline polling) for the new commit.
   Use the same polling parameters but reset the poll counter.

### 6e. Guardrails summary
- **Max 1 commit per fix attempt** -- agents must not make multiple commits.
- **Max 3 push cycles total** -- escalate to user after 3.
- **Diff size guard** -- >10 files or >200 lines added triggers user review.
- **No unrelated changes** -- fix agents are scoped strictly to the failing check.

</process>

<success_criteria>
- [ ] Review gate enforced -- /ship refuses without a passing review verdict
- [ ] Compass produces stakeholder-readable JSON with no jargon
- [ ] Atlas produces accurate dev JSON from actual git/test data
- [ ] Screenshots captured when possible, graceful fallback when not
- [ ] HTML is fully self-contained -- opens correctly from filesystem
- [ ] PR created with meaningful body derived from presentation
- [ ] Inline CI monitoring catches failures within ~5 minutes
- [ ] Watcher script generated for async cases
- [ ] Failure resolution routes to correct agents per classification table
- [ ] Max 3 auto-fix attempts before surfacing to user
- [ ] All artifacts written to .forgeflow/ (gitignored)
</success_criteria>
