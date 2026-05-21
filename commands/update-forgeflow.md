---
name: update-forgeflow
description: Pull the latest Forgeflow from the source repo and sync agents, commands, project rules, patterns, runtime helpers, templates, and hooks to ~/.claude/
argument-hint: "[--repair] [--rollback] [--json] [--dry-run]"
allowed-tools:
  - Bash
---
<objective>
Pull the latest Forgeflow release from GitHub via curl and sync updated files into ~/.claude/. Shows exactly which files changed. Never touches custom agents or any non-Forgeflow files. Runtime helpers are installed under `~/.claude/forgeflow/scripts/forgeflow/` so commands can work without a local Forgeflow clone.
</objective>

<context>
$ARGUMENTS:
- `--repair` — reinstall all managed Forgeflow files from upstream `main`, even when the installed SHA is already current. Use this when a managed command, agent, hook, template, pattern, or runtime helper is corrupted. Plain `/update-forgeflow` also performs this repair automatically when the installed SHA is current but required managed files are missing.
- `--rollback` — restore the previous managed-file snapshot from `~/.claude/forgeflow/backups/previous`. This only covers Forgeflow-managed files and never touches `custom-*` agents.
- `--json` — emit machine-readable helper output.
- `--dry-run` — plan without writing files.
</context>

<process>

## Preferred Engine

When the installed or repo-local runtime helper exists, prefer the script-backed installer because it enforces the same manifest used by health checks:

```bash
HELPER_DIR="scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/update-forgeflow.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/update-forgeflow.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ -x "${HELPER_DIR}/update-forgeflow.js" ]; then
  "${HELPER_DIR}/update-forgeflow.js" $ARGUMENTS
  exit $?
fi
```

The remaining steps are the command contract and fallback procedure for environments where the helper is not available yet.

## Step 1 — Fetch Latest SHA

```bash
LATEST=$(curl -sf "https://api.github.com/repos/BrandedTamarasu-glitch/ForgeFlow/commits/main" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['sha'])")
```

If the curl command fails or `LATEST` is empty, stop: `"Cannot reach GitHub API. Check your internet connection and try again."`

Validate that `LATEST` is a 40-character hex string:
```bash
[[ "$LATEST" =~ ^[0-9a-f]{40}$ ]] || stop "Unexpected SHA format from GitHub API."
```

```bash
LATEST_SHORT=${LATEST:0:7}
```

## Step 2 — Check Current Version

```bash
CURRENT=$(cat ~/.claude/forgeflow-version 2>/dev/null)
CURRENT_SHORT=${CURRENT:0:7}
```

If `CURRENT` is non-empty, validate it is a 40-character hex string:
```bash
[[ -z "$CURRENT" || "$CURRENT" =~ ^[0-9a-f]{40}$ ]] || stop "Corrupt version file: ~/.claude/forgeflow-version. Delete it and re-run."
```

If `CURRENT` is non-empty and equals `LATEST`, verify required managed files still exist locally. If any are missing, run the repair sync path even without `--repair`; otherwise print `"Already up to date ($LATEST_SHORT)."` and stop.

## Step 3 — Resolve Files to Sync

**First run** (CURRENT is empty — no version file):

Use the contents API to list all tracked files:

```bash
curl -sf "https://api.github.com/repos/BrandedTamarasu-glitch/ForgeFlow/contents/agents" \
  | python3 -c "import json,sys; [print('agents/'+f['name']) for f in json.load(sys.stdin) if f['type']=='file' and f['name'].endswith('.md')]"

curl -sf "https://api.github.com/repos/BrandedTamarasu-glitch/ForgeFlow/contents/agents/_shared" \
  | python3 -c "import json,sys; [print('agents/_shared/'+f['name']) for f in json.load(sys.stdin) if f['type']=='file' and f['name'].endswith('.md')]"

curl -sf "https://api.github.com/repos/BrandedTamarasu-glitch/ForgeFlow/contents/commands" \
  | python3 -c "import json,sys; [print('commands/'+f['name']) for f in json.load(sys.stdin) if f['type']=='file' and f['name'].endswith('.md')]"

curl -sf "https://api.github.com/repos/BrandedTamarasu-glitch/ForgeFlow/contents/project-rules" \
  | python3 -c "import json,sys; [print('project-rules/'+f['name']) for f in json.load(sys.stdin) if f['type']=='file' and f['name'].endswith('.md')]"

curl -sf "https://api.github.com/repos/BrandedTamarasu-glitch/ForgeFlow/contents/forgeflow-patterns" \
  | python3 -c "import json,sys; [print('forgeflow-patterns/'+f['name']) for f in json.load(sys.stdin) if f['type']=='file' and f['name'].endswith('.md')]"

curl -sf "https://api.github.com/repos/BrandedTamarasu-glitch/ForgeFlow/contents/scripts/forgeflow" \
  | python3 -c "
import json, sys
for f in json.load(sys.stdin):
    name = f['name']
    if f['type'] == 'file' and (name.endswith('.js') or name.endswith('.sh')) and not name.startswith('test-'):
        print('scripts/forgeflow/'+name)
"

# Also list files in each commands subdirectory
curl -sf "https://api.github.com/repos/BrandedTamarasu-glitch/ForgeFlow/contents/commands" \
  | python3 -c "
import json, sys, urllib.request
dirs = [f['name'] for f in json.load(sys.stdin) if f['type']=='dir']
for d in dirs:
    url = f'https://api.github.com/repos/BrandedTamarasu-glitch/ForgeFlow/contents/commands/{d}'
    with urllib.request.urlopen(url) as r:
        for f in json.loads(r.read()):
            if f['type']=='file' and f['name'].endswith('.md'):
                print(f'commands/{d}/{f[\"name\"]}')
"

```

Add to the list: `templates/ship-presentation.html`, `templates/forgeflow-budget.json`, `hooks/forgeflow-gate.js`, `hooks/forgeflow-context-monitor.js`, `hooks/forgeflow-statusline.js`, and `hooks/forgeflow-telemetry.js`

Set `FIRST_RUN=true`.

**Incremental** (CURRENT is non-empty):

Use the compare API to get only added/modified tracked files:

```bash
curl -sf "https://api.github.com/repos/BrandedTamarasu-glitch/ForgeFlow/compare/${CURRENT}...${LATEST}" \
  | python3 -c "
import json, sys, re
d = json.load(sys.stdin)
for f in d.get('files', []):
    if f['status'] not in ('added', 'modified'):
        continue
    name = f['filename']
    if re.match(r'^agents/[^/]+\.md$', name): print(name)
    elif re.match(r'^agents/_shared/[^/]+\.md$', name): print(name)
    elif re.match(r'^commands/[^/]+(?:/[^/]+)?\.md$', name): print(name)
    elif re.match(r'^project-rules/[^/]+\.md$', name): print(name)
    elif re.match(r'^forgeflow-patterns/[^/]+\.md$', name): print(name)
    elif re.match(r'^scripts/forgeflow/(?!test-)[^/]+\.(js|sh)$', name): print(name)
    elif name in ('templates/ship-presentation.html', 'templates/forgeflow-budget.json', 'hooks/forgeflow-gate.js', 'hooks/forgeflow-context-monitor.js', 'hooks/forgeflow-statusline.js', 'hooks/forgeflow-telemetry.js'): print(name)
"
```

Store the result as `FILES_TO_SYNC`. If empty, print:
```
Forgeflow repo advanced ($CURRENT_SHORT → $LATEST_SHORT) but no tracked files changed.
```
Save `$LATEST` to `~/.claude/forgeflow-version` and stop.

Set `FIRST_RUN=false`.

Also capture deletions for the report (do not act on them):
```bash
curl -sf "https://api.github.com/repos/BrandedTamarasu-glitch/ForgeFlow/compare/${CURRENT}...${LATEST}" \
  | python3 -c "
import json, sys, re
d = json.load(sys.stdin)
for f in d.get('files', []):
    if f['status'] != 'removed':
        continue
    name = f['filename']
    if re.match(r'^(agents|commands|templates|hooks|project-rules|forgeflow-patterns)/', name): print(name)
    elif re.match(r'^scripts/forgeflow/(?!test-)[^/]+\.(js|sh)$', name): print(name)
"
```

Store as `DELETED_FILES`.

## Step 4 — Download Files

Before writing managed files, the script-backed updater preserves one rollback snapshot at:

```text
~/.claude/forgeflow/backups/previous/
```

The snapshot contains the previous contents and file modes for managed files that are about to be overwritten, plus a manifest with the prior `~/.claude/forgeflow-version`. If a managed file did not exist before the update, rollback removes that file. Custom agents and non-Forgeflow files are never included.

Ensure destination directories exist:
```bash
mkdir -p ~/.claude/agents ~/.claude/agents/_shared ~/.claude/commands ~/.claude/templates ~/.claude/hooks ~/.claude/project-rules ~/.claude/forgeflow-patterns ~/.claude/forgeflow/scripts/forgeflow
```

Raw base URL must be pinned to the exact SHA fetched in Step 1:

```bash
RAW_BASE_URL="https://raw.githubusercontent.com/BrandedTamarasu-glitch/ForgeFlow/${LATEST}/"
```

Skip any file in the `agents/` category whose destination basename starts with `custom-` — these are user-created agents that must never be overwritten.

For each file in `FILES_TO_SYNC`, download it to the matching destination. **For `agents/NAME.md` entries only: skip if NAME starts with `custom-`.**
- `agents/NAME.md` → `~/.claude/agents/NAME.md`  *(skip if NAME starts with `custom-`)*
- `agents/_shared/NAME.md` → `~/.claude/agents/_shared/NAME.md`
- `commands/NAME.md` → `~/.claude/commands/NAME.md`
- `commands/SUBDIR/NAME.md` → `~/.claude/commands/SUBDIR/NAME.md`  *(create `~/.claude/commands/SUBDIR/` if needed)*
- `project-rules/NAME.md` → `~/.claude/project-rules/NAME.md`
- `forgeflow-patterns/NAME.md` → `~/.claude/forgeflow-patterns/NAME.md`
- `templates/ship-presentation.html` → `~/.claude/templates/ship-presentation.html`
- `templates/forgeflow-budget.json` → `~/.claude/templates/forgeflow-budget.json`
- `hooks/forgeflow-gate.js` → `~/.claude/hooks/forgeflow-gate.js`
- `hooks/forgeflow-context-monitor.js` → `~/.claude/hooks/forgeflow-context-monitor.js`
- `hooks/forgeflow-statusline.js` → `~/.claude/hooks/forgeflow-statusline.js`
- `hooks/forgeflow-telemetry.js` → `~/.claude/hooks/forgeflow-telemetry.js`
- `scripts/forgeflow/NAME.js` → `~/.claude/forgeflow/scripts/forgeflow/NAME.js`  *(skip `test-*`)*
- `scripts/forgeflow/NAME.sh` → `~/.claude/forgeflow/scripts/forgeflow/NAME.sh`  *(skip `test-*`)*

Use `curl -sf` with `-o` for each download. If any download fails (non-zero exit), report the failure and continue with the remaining files — do not abort the entire sync. Track failures as `FAILED_FILES`.

For every successfully downloaded `scripts/forgeflow/*.js` and `scripts/forgeflow/*.sh`, run:

```bash
chmod 755 "$DEST"
```

Set `HOOK_CHANGED=true` if `hooks/forgeflow-gate.js` was in `FILES_TO_SYNC`.
Set `SCRIPT_CHANGED=true` if any `scripts/forgeflow/*` file was in `FILES_TO_SYNC`.

Track count of files successfully downloaded as `N`. For each successful file, record:
- source path
- destination path
- before SHA-256 of the destination, or `new` when it did not exist
- after SHA-256 of the destination

## Step 5 — Save Version

If `FAILED_FILES` is non-empty, do not update `~/.claude/forgeflow-version`. Report the failed files and instruct the user to re-run `/update-forgeflow` after fixing network or permission issues.

```bash
if [ -z "${FAILED_FILES:-}" ]; then
  printf '%s\n' "$LATEST" > ~/.claude/forgeflow-version
fi
```

## Step 6 — Report

**Standard report:**
```
Forgeflow updated  ($CURRENT_SHORT → $LATEST_SHORT)

Files synced (N):
  {file 1}  {before-sha} → {after-sha}
  {file 2}  {before-sha} → {after-sha}
  ...
```

If `FIRST_RUN=true`, replace the header line with:
```
Forgeflow installed  ($LATEST_SHORT)
```

If `DELETED_FILES` is non-empty, append:
```
Note: the following files were removed from the repo but NOT deleted from ~/.claude/ — remove manually if desired:
  {deleted file 1}
```

If `HOOK_CHANGED=true`, append:
```
NOTICE: hooks/forgeflow-gate.js was updated. Verify the hook wiring in settings.json
still points to the correct path. Hook wiring is NOT auto-updated by /update-forgeflow.
Check: cat ~/.claude/settings.json | grep forgeflow
```

If `SCRIPT_CHANGED=true`, append:
```
Runtime helpers updated under ~/.claude/forgeflow/scripts/forgeflow/.
Commands should prefer that installed helper root when project-local scripts/forgeflow/ is absent.
```

## Repair mode

When `--repair` is set:

- Fetch the upstream `main` tree for the latest SHA.
- Resolve all managed files through the same manifest as normal install.
- Reinstall every managed file, not just files changed since the installed SHA.
- Preserve a rollback snapshot before writing.
- Save `~/.claude/forgeflow-version` only if every required file sync succeeds.

Report header:

```text
Forgeflow repaired (<latest-short-sha>)
```

## Rollback mode

When `--rollback` is set:

- Do not contact GitHub.
- Read `~/.claude/forgeflow/backups/previous/manifest.json`.
- Restore files that existed before the previous update.
- Remove managed files that were newly created by the previous update.
- Restore `~/.claude/forgeflow-version` to the snapshot version after a clean rollback.
- Never touch `settings.json`, custom agents, or non-Forgeflow files.

If no snapshot exists, report:

```text
No Forgeflow rollback snapshot found at ~/.claude/forgeflow/backups/previous.
```

</process>

<success_criteria>
- [ ] Fetches latest SHA from GitHub API — stops with clear message if unreachable
- [ ] Reads version from ~/.claude/forgeflow-version; exits cleanly if already up to date
- [ ] First run: downloads all tracked files via contents API (no prior version needed)
- [ ] Incremental: uses compare API to download only added/modified tracked files
- [ ] Tracked paths: agents/*.md (flat), agents/_shared/*.md, commands/*.md (flat), commands/*/*.md (one-level subdirs), project-rules/*.md (flat), forgeflow-patterns/*.md, scripts/forgeflow/*.js and *.sh except test-*, templates/ship-presentation.html, templates/forgeflow-budget.json, hooks/forgeflow-gate.js, hooks/forgeflow-context-monitor.js, hooks/forgeflow-statusline.js, hooks/forgeflow-telemetry.js
- [ ] Commands in subdirectories (e.g. commands/agent-chat/on.md) sync to ~/.claude/commands/SUBDIR/NAME.md — subdir created if needed
- [ ] Runtime helpers sync to ~/.claude/forgeflow/scripts/forgeflow/ and are chmod 755
- [ ] Never auto-deletes files from ~/.claude/ — deletions reported only
- [ ] Never overwrites files in ~/.claude/agents/ whose basename starts with `custom-`
- [ ] Never touches GSD agents or other non-Forgeflow files
- [ ] Individual download failures are reported but do not abort the sync
- [ ] Saves new SHA to ~/.claude/forgeflow-version only after all required downloads succeed
- [ ] `--repair` reinstalls all managed files from upstream `main`
- [ ] Before writes, one previous managed-file snapshot is saved under ~/.claude/forgeflow/backups/previous
- [ ] `--rollback` restores the previous snapshot without touching custom agents or settings.json
- [ ] Summary lists every file synced with before/after SHAs
- [ ] Hook-changed warning appears when hooks/forgeflow-gate.js is in the diff
- [ ] No local clone required — works from curl alone
- [ ] Script-backed path uses the same manifest mapping as health/install smoke tests
</success_criteria>
