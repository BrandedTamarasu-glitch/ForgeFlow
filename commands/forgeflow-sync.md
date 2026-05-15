---
name: forgeflow-sync
description: Sync shared Forgeflow state (learnings, patterns, history) with a team git remote
argument-hint: "--init <remote-url> | --push | --pull | --status | --merge"
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---

<objective>
Synchronise shared Forgeflow state — `learnings.jsonl`, `patterns.md`, `codebase-map.md`, `review-history.md` — with a team-owned git remote so that multiple developers on the same project share a single growing knowledge base.

`--init` wires up the remote once. `--push` and `--pull` move state in and out. `--status` reports drift. `--merge` resolves conflicts after a pull.

`agent-notes/` is per-user and is never synced.
</objective>

<context>
$ARGUMENTS:
- `--init <remote-url>` — initialise sync for this project: validate URL, write config.json, create remote repo if needed, push initial state
- `--push` — copy shared files to the forgeflow-state remote and push
- `--pull` — fetch remote state: union dedup on learnings.jsonl, remote-wins overwrite for the rest
- `--status` — show remote, last push/pull timestamps, and ahead/behind state
- `--merge` — scan for conflict markers and print resolution instructions

All output lines are prefixed `[forgeflow-sync]`. Error format: `[forgeflow-sync] ERROR: <what failed> — <why>. <next action>.`
</context>

## Gotchas

1. **Never `git merge` learnings.jsonl.** Union dedup algorithm only. Git merge on JSONL produces malformed JSON on any conflict.
2. **Never `git add .` or `git add -A`.** Stage only named shared files. `agent-notes/` must never be pushed.
3. **`--push` and `--pull` require config.json.** Emit the exact missing field in any config error — not a generic message.
4. **`--init` idempotency.** Same URL: skip silently. Different URL: show old + new, require confirmation (`--yes` or `y/N`).
5. **Fork push safety.** Before any push: compare `config.remote_url` to `git remote get-url forgeflow-state`. Abort if different.
6. **Gitignore gate is step ZERO.** Blocking, not advisory. Verify `.forgeflow/` in `.gitignore` before any other `--init` step.
7. **PAT is env-only.** `$GITHUB_TOKEN`. Never prompt. Never store. Never log.
8. **URL validation.** Reject credential-embedded URLs before writing to config or passing to git. Valid schemes: `https`, `git`, `git@`.
9. **API timeout/retry.** GitHub API call: 10s timeout, single retry on 5xx.
10. **`--push` is required after `--init`.** `--init` creates and registers the remote repo; it does not push state. Run `/forgeflow-sync --push` immediately after `--init` to populate the remote.
11. **All output prefixed `[forgeflow-sync]`.** No exceptions. Error format: `[forgeflow-sync] ERROR: <what failed> — <why>. <next action>.`
12. **V1 dedup limitation.** Full-line string match only. JSON entries with identical content but different field order are treated as distinct entries.
13. **`team_members[0].username` default.** If config.json absent or `team_members` empty, username = `local` everywhere.
14. **`--pull` overwrites local edits (remote-wins).** For `patterns.md`, `codebase-map.md`, and `review-history.md`, `--pull` replaces the local file with the remote version. Local edits to these files are discarded without confirmation (logged). Commit or back up local changes before pulling.

<process>

## Subcommand: --init

```bash
PROJECT=$(basename "$PWD")
if ! [[ "$PROJECT" =~ ^[a-zA-Z0-9._-]+$ ]]; then
  echo "[forgeflow-sync] ERROR: project directory name contains unsafe characters — rename to use only letters, digits, dots, underscores, or hyphens."
  exit 1
fi
if [[ "$PROJECT" =~ ^\. ]]; then
  echo "[forgeflow-sync] ERROR: project directory name must not begin with a dot."
  exit 1
fi
CONFIG_DIR=".forgeflow/$PROJECT"
CONFIG_FILE="$CONFIG_DIR/config.json"
REMOTE_URL="$1"
```

### Step 0 (BLOCKING): Verify .gitignore

Check that `.forgeflow/` is listed in `.gitignore`. If missing, append it.

```bash
if ! grep -qxF '.forgeflow/' .gitignore 2>/dev/null; then
  if ! echo '.forgeflow/' >> .gitignore; then
    echo "[forgeflow-sync] ERROR: Cannot write to .gitignore — check file permissions. Resolve and re-run --init."
    exit 1
  fi
  echo "[forgeflow-sync] Appended .forgeflow/ to .gitignore."
fi
echo "[forgeflow-sync] Verifying .gitignore... OK"
```

Do not proceed to any later step until this check passes.

### Step 1: Check GITHUB_TOKEN

```bash
if [ -z "$GITHUB_TOKEN" ]; then
  echo "[forgeflow-sync] ERROR: GITHUB_TOKEN is not set — authentication required. Export your GitHub PAT before running --init."
  exit 1
fi
```

### Step 2: Validate remote URL

Reject any URL containing `user:pass@` (credential-embedded). Reject if scheme is not `https://`, `git://`, or `git@`.

```bash
if [[ "$REMOTE_URL" =~ ://[^/@]+:[^/@]+@ ]]; then
  echo "[forgeflow-sync] ERROR: Credential-embedded URL rejected — remove user:pass from URL. Pass credentials via GITHUB_TOKEN only."
  exit 1
fi
if ! [[ "$REMOTE_URL" =~ ^(https://|git://|git@) ]]; then
  echo "[forgeflow-sync] ERROR: Invalid URL scheme — accepted schemes are https://, git://, git@. Provide a valid remote URL."
  exit 1
fi
```

### Step 3: Check existing config.json

**Case A — config.json exists and remote_url matches the argument:**

```
[forgeflow-sync] Config found. Remote already configured — nothing to do.
```

Exit.

**Case B — config.json exists and remote_url differs:**

```
[forgeflow-sync] Remote URL mismatch in existing config.
[forgeflow-sync]   Old: <current remote_url>
[forgeflow-sync]   New: <argument>
[forgeflow-sync] Proceed? [y/N]
```

If `--yes` flag is present, skip the prompt and proceed. Otherwise wait for input. On `n` or any non-`y` answer, exit without changes.

On confirmation:

```bash
git remote set-url forgeflow-state "$REMOTE_URL"
jq --arg url "$REMOTE_URL" '.remote_url = $url' "$CONFIG_FILE" > /tmp/forgeflow_sync_config_tmp.json && mv /tmp/forgeflow_sync_config_tmp.json "$CONFIG_FILE"
echo "[forgeflow-sync] Remote URL updated in git remote and config.json."
```

**Case C — config.json absent:**

Create directory and write config.json with all schema fields:

```bash
mkdir -p "$CONFIG_DIR"
jq -n --arg r "$REMOTE_URL" '{"remote_url":$r,"strategy":"git-v1","sync_branch":"main","team_members":[]}' > "$CONFIG_FILE"
echo "[forgeflow-sync] Config written to $CONFIG_FILE"
```

### Step 4: Create remote repo if needed

If the remote repository does not exist, call the GitHub API to create `forgeflow-state-<project>`.

```bash
echo "[forgeflow-sync] Calling GitHub API to create repository..."
RESPONSE=$(curl --silent --max-time 10 -w "\n%{http_code}" \
  --oauth2-bearer "$GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -d "{\"name\":\"forgeflow-state-$PROJECT\",\"private\":true}" \
  https://api.github.com/user/repos)

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
RESPONSE_BODY=$(echo "$RESPONSE" | head -n -1)

if [[ "$HTTP_CODE" =~ ^5 ]]; then
  # Retry once on 5xx only
  RESPONSE=$(curl --silent --max-time 10 -w "\n%{http_code}" \
    --oauth2-bearer "$GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -d "{\"name\":\"forgeflow-state-$PROJECT\",\"private\":true}" \
    https://api.github.com/user/repos)
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  RESPONSE_BODY=$(echo "$RESPONSE" | head -n -1)
fi

if [ "$HTTP_CODE" = "201" ]; then
  REPO_URL=$(echo "$RESPONSE_BODY" | jq -r '.html_url')
  echo "[forgeflow-sync] Created: $REPO_URL"
elif [ "$HTTP_CODE" = "422" ]; then
  echo "[forgeflow-sync] Repository already exists — proceeding."
elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo "[forgeflow-sync] ERROR: GitHub API authentication failed (HTTP $HTTP_CODE) — check GITHUB_TOKEN. Re-run --init after fixing credentials."
  exit 1
else
  echo "[forgeflow-sync] ERROR: GitHub API returned HTTP $HTTP_CODE — check token permissions and try again."
  exit 1
fi
```

### Step 5: Register git remote

```bash
if git remote get-url forgeflow-state &>/dev/null; then
  git remote set-url forgeflow-state "$REMOTE_URL"
else
  git remote add forgeflow-state "$REMOTE_URL"
fi
```

### Step 6: Done

```
[forgeflow-sync] Done. Run /forgeflow-sync --push to sync your forgeflow-state files.
```

---

## Subcommand: --push

```bash
PROJECT=$(basename "$PWD")
if ! [[ "$PROJECT" =~ ^[a-zA-Z0-9._-]+$ ]]; then
  echo "[forgeflow-sync] ERROR: project directory name contains unsafe characters — rename to use only letters, digits, dots, underscores, or hyphens."
  exit 1
fi
if [[ "$PROJECT" =~ ^\. ]]; then
  echo "[forgeflow-sync] ERROR: project directory name must not begin with a dot."
  exit 1
fi
CONFIG_FILE=".forgeflow/$PROJECT/config.json"
SHARED_FILES=(learnings.jsonl patterns.md codebase-map.md review-history.md)
```

### Step 1: Read config.json

```bash
if [ ! -f "$CONFIG_FILE" ]; then
  echo "[forgeflow-sync] ERROR: Cannot push — config.json not found. Run /forgeflow-sync --init <remote-url> first."
  exit 1
fi
CONFIG_REMOTE=$(jq -r '.remote_url // empty' "$CONFIG_FILE")
if [ -z "$CONFIG_REMOTE" ]; then
  echo "[forgeflow-sync] ERROR: config.json is missing required field remote_url — re-run --init to repair."
  exit 1
fi
if [[ "$CONFIG_REMOTE" =~ ://[^/@]+:[^/@]+@ ]]; then
  echo "[forgeflow-sync] ERROR: Credential-embedded URL in config.json — remove user:pass from remote_url. Update config.json manually or re-run --init."
  exit 1
fi
if ! [[ "$CONFIG_REMOTE" =~ ^(https://|git://|git@) ]]; then
  echo "[forgeflow-sync] ERROR: Invalid URL scheme in config.json — accepted schemes are https://, git://, git@. Re-run --init to fix."
  exit 1
fi
```

### Step 2: Fork push safety check

```bash
ACTUAL_REMOTE=$(git remote get-url forgeflow-state 2>/dev/null)
if [ "$CONFIG_REMOTE" != "$ACTUAL_REMOTE" ]; then
  echo "[forgeflow-sync] ERROR: Remote URL mismatch. Expected $CONFIG_REMOTE, got $ACTUAL_REMOTE. Re-run forgeflow-sync --init to fix."
  exit 1
fi
```

### Step 2.5: Clone forgeflow-state repo into a temporary working area

```bash
FORGEFLOW_STATE_DIR=$(mktemp -d)
chmod 700 "$FORGEFLOW_STATE_DIR"
trap 'rm -rf "$FORGEFLOW_STATE_DIR"' EXIT
git clone --depth 1 "$CONFIG_REMOTE" "$FORGEFLOW_STATE_DIR" 2>&1
if [ $? -ne 0 ]; then
  echo "[forgeflow-sync] ERROR: Failed to clone $CONFIG_REMOTE — check remote URL and network access."
  exit 1
fi
```

### Step 3: Copy shared files

For each file in `(learnings.jsonl, patterns.md, codebase-map.md, review-history.md)`:

```bash
PUSHED_COUNT=0
for f in "${SHARED_FILES[@]}"; do
  SRC=".forgeflow/$PROJECT/$f"
  if [ -f "$SRC" ]; then
    cp "$SRC" "$FORGEFLOW_STATE_DIR/$f"
    echo "[forgeflow-sync]   $f — copied"
    PUSHED_COUNT=$((PUSHED_COUNT + 1))
  fi
done
```

### Step 4: Skip agent-notes/

```
[forgeflow-sync]   agent-notes/ — skipped (per-user, not synced)
```

Never stage, copy, or touch any file under `agent-notes/`.

### Step 5: Stage by name only

```bash
for f in "${SHARED_FILES[@]}"; do
  git -C "$FORGEFLOW_STATE_DIR" add "$f"
done
```

NEVER run `git add .` or `git add -A`.

### Step 6: Commit

```bash
if git -C "$FORGEFLOW_STATE_DIR" diff --cached --quiet; then
  echo "[forgeflow-sync] Nothing new to push — forgeflow-state already up to date."
  exit 0
fi
SYNC_DATE=$(date +%Y-%m-%d)
git -C "$FORGEFLOW_STATE_DIR" -c "user.name=forgeflow-sync" -c "user.email=forgeflow-sync@local" commit -m "chore(sync): push $PROJECT state $SYNC_DATE"
```

### Step 7: Push

```bash
git -C "$FORGEFLOW_STATE_DIR" push origin main
```

### Step 8: Summary

```bash
date -u +"%Y-%m-%dT%H:%M:%SZ" > ".forgeflow/$PROJECT/.last-push"
echo "[forgeflow-sync] Summary: $PUSHED_COUNT files pushed, agent-notes/ skipped."
```

---

## Subcommand: --pull

```bash
PROJECT=$(basename "$PWD")
if ! [[ "$PROJECT" =~ ^[a-zA-Z0-9._-]+$ ]]; then
  echo "[forgeflow-sync] ERROR: project directory name contains unsafe characters — rename to use only letters, digits, dots, underscores, or hyphens."
  exit 1
fi
if [[ "$PROJECT" =~ ^\. ]]; then
  echo "[forgeflow-sync] ERROR: project directory name must not begin with a dot."
  exit 1
fi
CONFIG_FILE=".forgeflow/$PROJECT/config.json"
STATE_DIR=".forgeflow/$PROJECT"
```

### Step 1: Read config.json

```bash
if [ ! -f "$CONFIG_FILE" ]; then
  echo "[forgeflow-sync] ERROR: Cannot pull — config.json not found. Run /forgeflow-sync --init <remote-url> first."
  exit 1
fi
CONFIG_REMOTE=$(jq -r '.remote_url // empty' "$CONFIG_FILE")
if [ -z "$CONFIG_REMOTE" ]; then
  echo "[forgeflow-sync] ERROR: config.json is missing required field remote_url — re-run --init to repair."
  exit 1
fi
if [[ "$CONFIG_REMOTE" =~ ://[^/@]+:[^/@]+@ ]]; then
  echo "[forgeflow-sync] ERROR: Credential-embedded URL in config.json — remove user:pass from remote_url. Update config.json manually or re-run --init."
  exit 1
fi
if ! [[ "$CONFIG_REMOTE" =~ ^(https://|git://|git@) ]]; then
  echo "[forgeflow-sync] ERROR: Invalid URL scheme in config.json — accepted schemes are https://, git://, git@. Re-run --init to fix."
  exit 1
fi
ACTUAL_REMOTE=$(git remote get-url forgeflow-state 2>/dev/null)
if [ "$CONFIG_REMOTE" != "$ACTUAL_REMOTE" ]; then
  echo "[forgeflow-sync] ERROR: Remote URL mismatch. Expected $CONFIG_REMOTE, got $ACTUAL_REMOTE. Re-run forgeflow-sync --init to fix."
  exit 1
fi
```

### Step 2: Clone remote

```bash
PULL_WORK_DIR=$(mktemp -d)
chmod 700 "$PULL_WORK_DIR"
trap 'rm -rf "$PULL_WORK_DIR"' EXIT
git clone --depth 1 "$CONFIG_REMOTE" "$PULL_WORK_DIR" 2>&1
if [ $? -ne 0 ]; then
  echo "[forgeflow-sync] ERROR: Failed to clone $CONFIG_REMOTE — check remote URL and network access."
  exit 1
fi
```

### Step 3: Union merge learnings.jsonl

Do NOT run `git merge` on this file. Use the union dedup algorithm only.

```bash
LOCAL_FILE="$STATE_DIR/learnings.jsonl"
REMOTE_JSONL="$PULL_WORK_DIR/learnings.jsonl"

LOCAL_COUNT=0
REMOTE_COUNT=0
NEW_COUNT=0

mkdir -p "$STATE_DIR"
touch "$LOCAL_FILE" 2>/dev/null
declare -A LOCAL_LINES
while IFS= read -r line; do
  [ -z "$line" ] && continue
  LOCAL_LINES["$line"]=1
  LOCAL_COUNT=$((LOCAL_COUNT + 1))
done < "$LOCAL_FILE"

if [ ! -f "$REMOTE_JSONL" ]; then
  echo "[forgeflow-sync]   learnings.jsonl — not found on remote, skipping union merge"
else
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    REMOTE_COUNT=$((REMOTE_COUNT + 1))
    if [ -z "${LOCAL_LINES[$line]+_}" ]; then
      echo "$line" >> "$LOCAL_FILE"
      NEW_COUNT=$((NEW_COUNT + 1))
    fi
  done < "$REMOTE_JSONL"
fi

UNIQUE_COUNT=$((LOCAL_COUNT + NEW_COUNT))
echo "[forgeflow-sync]   learnings.jsonl — union merge: $LOCAL_COUNT local + $REMOTE_COUNT remote → $UNIQUE_COUNT unique entries"
```

Dedup key = full line string. Field order differences create false duplicates — this is a known V1 limitation.

### Step 4: Overwrite local files (remote-wins)

For each of `patterns.md`, `codebase-map.md`, `review-history.md`:

```bash
PULLED_COUNT=0
for f in patterns.md codebase-map.md review-history.md; do
  if [ -f "$PULL_WORK_DIR/$f" ]; then
    cp "$PULL_WORK_DIR/$f" "$STATE_DIR/$f"
    echo "[forgeflow-sync]   $f — replaced with remote (local overwritten)"
    PULLED_COUNT=$((PULLED_COUNT + 1))
  else
    echo "[forgeflow-sync]   $f — not found on remote, skipping"
  fi
done
```

### Step 5: Summary

```bash
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$STATE_DIR/.last-pull"
echo "[forgeflow-sync] Summary: $PULLED_COUNT files pulled. All clean."
```

---

## Subcommand: --status

```bash
PROJECT=$(basename "$PWD")
if ! [[ "$PROJECT" =~ ^[a-zA-Z0-9._-]+$ ]]; then
  echo "[forgeflow-sync] ERROR: project directory name contains unsafe characters — rename to use only letters, digits, dots, underscores, or hyphens."
  exit 1
fi
if [[ "$PROJECT" =~ ^\. ]]; then
  echo "[forgeflow-sync] ERROR: project directory name must not begin with a dot."
  exit 1
fi
CONFIG_FILE=".forgeflow/$PROJECT/config.json"
```

### Step 1: Read config.json

```bash
if [ ! -f "$CONFIG_FILE" ]; then
  echo "[forgeflow-sync] ERROR: Cannot show status — config.json not found. Run /forgeflow-sync --init <remote-url> first."
  exit 1
fi
```

### Step 2: Print status

```bash
REMOTE_URL=$(jq -r '.remote_url // empty' "$CONFIG_FILE")
if [ -z "$REMOTE_URL" ]; then
  echo "[forgeflow-sync] ERROR: config.json is missing required field remote_url — re-run --init to repair."
  exit 1
fi
LAST_PUSH=$(cat ".forgeflow/$PROJECT/.last-push" 2>/dev/null || echo "never")
LAST_PULL=$(cat ".forgeflow/$PROJECT/.last-pull" 2>/dev/null || echo "never")

git fetch forgeflow-state main --quiet 2>/dev/null || true
REMOTE_HEAD=$(git ls-remote forgeflow-state refs/heads/main 2>/dev/null | awk '{print $1}')
LOCAL_HEAD=$(git rev-parse forgeflow-state/main 2>/dev/null)

if [ -z "$REMOTE_HEAD" ]; then
  SYNC_STATE="[remote unreachable]"
elif [ -z "$LOCAL_HEAD" ]; then
  SYNC_STATE="[never synced — run --pull]"
elif [ "$REMOTE_HEAD" = "$LOCAL_HEAD" ]; then
  SYNC_STATE="[synced]"
else
  SYNC_STATE="[remote has changes — run --pull]"
fi

echo "[forgeflow-sync] Project:    $PROJECT"
echo "[forgeflow-sync] Remote URL: $REMOTE_URL"
echo "[forgeflow-sync] Last push:  $LAST_PUSH"
echo "[forgeflow-sync] Last pull:  $LAST_PULL"
echo "[forgeflow-sync] Sync state: $SYNC_STATE"
```

---

## Subcommand: --merge

```bash
PROJECT=$(basename "$PWD")
if ! [[ "$PROJECT" =~ ^[a-zA-Z0-9._-]+$ ]]; then
  echo "[forgeflow-sync] ERROR: project directory name contains unsafe characters — rename to use only letters, digits, dots, underscores, or hyphens."
  exit 1
fi
if [[ "$PROJECT" =~ ^\. ]]; then
  echo "[forgeflow-sync] ERROR: project directory name must not begin with a dot."
  exit 1
fi
STATE_DIR=".forgeflow/$PROJECT"
SHARED_FILES=(patterns.md codebase-map.md review-history.md)
```

### Step 1: Scan for conflict markers

```bash
CONFLICT_COUNT=0
CONFLICT_FILES=()
for f in "${SHARED_FILES[@]}"; do
  FILE="$STATE_DIR/$f"
  if grep -n '<<<<<<<\|=======\|>>>>>>>' "$FILE" 2>/dev/null; then
    echo "[forgeflow-sync]   $f — conflicts at lines above"
    ((CONFLICT_COUNT++))
    CONFLICT_FILES+=("$f")
  fi
done

if [ "$CONFLICT_COUNT" -eq 0 ]; then
  echo "[forgeflow-sync] No conflict markers found in shared files."
  exit 0
fi
```

### Step 2: Report conflicts by file with line numbers

For each conflicted file, list the line numbers of `<<<<<<<`, `=======`, and `>>>>>>>` markers so the user can navigate directly.

### Step 3: Resolution instructions

```bash
echo "[forgeflow-sync] To resolve:"
echo "[forgeflow-sync]   1. Open the conflicted file(s) listed above."
echo "[forgeflow-sync]   2. Find each block bounded by <<<<<<< ... ======= ... >>>>>>>."
echo "[forgeflow-sync]   3. Keep the correct content, delete the markers and the discarded block."
echo "[forgeflow-sync]   4. Save the file."
for cf in "${CONFLICT_FILES[@]}"; do
  echo "[forgeflow-sync]   5. Stage: git add $STATE_DIR/$cf"
done
echo "[forgeflow-sync] When resolved, run /forgeflow-sync --push to publish."
```

</process>

<success_criteria>
- [ ] `--init` verifies .gitignore as step zero — blocks on failure
- [ ] `--init` rejects credential-embedded URLs and invalid schemes before touching config or git
- [ ] `--init` is idempotent: same URL exits silently; different URL requires confirmation
- [ ] `--init` creates config.json with all four schema fields: remote_url, strategy, sync_branch, team_members
- [ ] `--init` calls GitHub API with 10s timeout and single 5xx retry; on success, instructs user to run --push
- [ ] `--push` aborts on remote URL mismatch before any git operation
- [ ] `--push` stages only named files; never git add . or git add -A
- [ ] `--push` skips agent-notes/ and prints the skip line
- [ ] `--push` commit message follows: `chore(sync): push <project> state <YYYY-MM-DD>`
- [ ] `--pull` runs union dedup on learnings.jsonl — never git merge on that file
- [ ] `--pull` reports per-file outcome; all files replaced without conflict under remote-wins policy
- [ ] `--status` reports project, remote URL, last push time, and sync state in one of four states
- [ ] `--merge` scans patterns.md, codebase-map.md, review-history.md for conflict markers with line numbers
- [ ] Every output line prefixed [forgeflow-sync]; errors follow ERROR: <what> — <why>. <action>. format
</success_criteria>
