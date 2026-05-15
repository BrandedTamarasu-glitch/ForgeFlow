---
name: sync-upstream
description: Automate Forgeflow meta-work sync — copy changed files from ~/.claude/ to the Forgeflow repo, commit, and push
argument-hint: "[--dry-run] [--no-push] [--message <commit-msg>]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---
<objective>
When making meta-work changes to Forgeflow itself (editing commands, agents, project-rules, or templates in `~/.claude/`), this command detects which files differ from the upstream at `~/Claude/Work/Forgeflow/`, copies them, commits with a generated message, and pushes to origin.

Replaces the manual `cp → git add → git commit → git push` flow done repeatedly per session.
</objective>

<context>
$ARGUMENTS:
- `--dry-run` — show what would sync, do not copy or commit
- `--no-push` — copy and commit locally only, skip the push
- `--message <msg>` — use the provided commit message instead of auto-generating

No arguments: full sync (copy → commit → push).
</context>

## Gotchas
- **Only syncs ~/.claude/ → upstream, NOT upstream → ~/.claude/.** For the reverse direction, use `/update-forgeflow` which pulls from GitHub.
- **Commit account matters.** The Forgeflow repo is owned by `BrandedTamarasu-glitch`. If `gh auth` active account is different, the push may 403. Command auto-switches active account for the push, then switches back.
- **Never force-pushes.** If upstream has diverged (someone else pushed), the push fails; command reports the divergence and asks the user to pull-rebase manually.
- **Auto-generated commit message is based on diff.** If you want a specific message, use `--message "..."`. Auto-message format: `chore(sync): <N> file(s) synced from ~/.claude/ (<file list summary>)`.
- **Subdir files covered.** Handles `agents/`, `commands/` (including `commands/SUBDIR/`), `project-rules/`, `templates/`, `hooks/`. Does NOT touch `services/`, `docs/`, or `.claude-plugin/` — those require manual attention.

<process>

## Step 1: Locate upstream

```bash
UPSTREAM="$HOME/Claude/Work/Forgeflow"
if [ ! -d "$UPSTREAM/.git" ]; then
  echo "Upstream clone not found at $UPSTREAM"
  echo "Clone with: git clone https://github.com/BrandedTamarasu-glitch/ForgeFlow.git $UPSTREAM"
  exit 1
fi
```

## Step 2: Verify upstream clean + up-to-date

```bash
cd "$UPSTREAM"
git fetch origin
BEHIND=$(git rev-list --count HEAD..origin/main)
if [ "$BEHIND" -gt 0 ]; then
  echo "Upstream clone is $BEHIND commits behind origin/main. Pull first."
  git pull --ff-only
fi

# Confirm clean working tree
if [ -n "$(git status --porcelain)" ]; then
  echo "Upstream has uncommitted changes:"
  git status -sb
  # Ask user: "stash", "commit-separately", or "abort"
fi
```

## Step 3: Detect changed files

For each forgeflow-managed directory, diff local vs upstream:
```bash
DIRS=(agents commands commands/agent-chat project-rules templates hooks)
CHANGED=()
for dir in "${DIRS[@]}"; do
  LOCAL_DIR="$HOME/.claude/$dir"
  UP_DIR="$UPSTREAM/$dir"
  [ ! -d "$LOCAL_DIR" ] && continue
  for f in "$LOCAL_DIR"/*.md "$LOCAL_DIR"/*.js "$LOCAL_DIR"/*.html; do
    [ ! -f "$f" ] && continue
    REL="${f#$HOME/.claude/}"
    UP_FILE="$UPSTREAM/$REL"
    if [ ! -f "$UP_FILE" ] || ! cmp -s "$f" "$UP_FILE"; then
      CHANGED+=("$REL")
    fi
  done
done
```

If `CHANGED` is empty, exit: `"Local ~/.claude/ is already in sync with upstream. Nothing to do."`

## Step 4: Show what would sync

```
Files to sync (<N>):
  commands/fleet.md         (modified)
  commands/review-auto.md   (modified)
  project-rules/new-rule.md (new)
  hooks/forgeflow-gate.js (modified)
```

If `--dry-run`, stop here.

## Step 5: User confirmation

Use AskUserQuestion:
```
Sync <N> file(s) to upstream and push?
Options: sync-and-push, sync-only (--no-push), cancel
```

If user cancels, exit.

## Step 6: Copy files

```bash
for rel in "${CHANGED[@]}"; do
  mkdir -p "$(dirname "$UPSTREAM/$rel")"
  cp "$HOME/.claude/$rel" "$UPSTREAM/$rel"
done
```

## Step 7: Commit

If `--message <msg>` was provided, use it. Otherwise generate:
```
chore(sync): <N> file(s) synced from ~/.claude/

Files:
  - commands/fleet.md
  - commands/review-auto.md
  - project-rules/new-rule.md

Local → upstream sync via /sync-upstream.
```

```bash
cd "$UPSTREAM"
git add <each file by name — never git add .>
git commit -m "<message>"
```

## Step 8: Push (unless --no-push)

```bash
# Ensure the ForgeFlow owner account is active for this repo
ACTIVE_ACCOUNT=$(gh auth status 2>&1 | awk '/Active account: true/ {found=1} found && /Logged in.*account/ {print $7; exit}')
if [ "$ACTIVE_ACCOUNT" != "BrandedTamarasu-glitch" ]; then
  PREVIOUS_ACCOUNT="$ACTIVE_ACCOUNT"
  gh auth switch --user BrandedTamarasu-glitch
fi

git push origin main 2>&1

# Restore previous account
if [ -n "$PREVIOUS_ACCOUNT" ]; then
  gh auth switch --user "$PREVIOUS_ACCOUNT"
fi
```

If push fails (non-fast-forward), stop and report:
```
Push rejected — upstream has diverged. Pull with:
  cd ~/Claude/Work/Forgeflow
  git pull --ff-only  # or --rebase if needed
  git push origin main
```

Do NOT force-push.

## Step 9: Report

```
## /sync-upstream complete

Synced: <N> file(s)
Commit: <sha>
Pushed: yes / no (--no-push) / skipped (push failed)

Next: /update-forgeflow can be run from any machine to pull this change.
```

</process>

<success_criteria>
- [ ] Upstream clone exists and is fetched + up to date (or pull performed)
- [ ] Diff detected changed files across agents/, commands/, project-rules/, templates/, hooks/
- [ ] User confirmed the sync plan (unless --dry-run)
- [ ] Files copied from ~/.claude/ to upstream
- [ ] Commit created with auto-generated or user-provided message
- [ ] Push attempted with correct account, never force-pushed
- [ ] Account switched back if temporary switch occurred
- [ ] Summary report printed with commit SHA
</success_criteria>
