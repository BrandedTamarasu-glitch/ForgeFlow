---
name: update-forgeflow
description: Pull the latest Forgeflow from the source repo and sync agents, commands, templates, and hooks to ~/.claude/
argument-hint: ""
allowed-tools:
  - Bash
---
<objective>
Pull the latest Forgeflow release from GitHub via curl and sync updated files into ~/.claude/. Shows exactly which files changed. Never touches custom agents or any non-Forgeflow files. No local clone required.
</objective>

<process>

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

If `CURRENT` is non-empty and equals `LATEST`, print `"Already up to date ($LATEST_SHORT)."` and stop.

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

Add to the list: `templates/ship-presentation.html`, `hooks/forgeflow-gate.js`, `hooks/forgeflow-context-monitor.js`, `hooks/forgeflow-statusline.js`, and `hooks/forgeflow-telemetry.js`

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
    elif name in ('templates/ship-presentation.html', 'hooks/forgeflow-gate.js', 'hooks/forgeflow-context-monitor.js', 'hooks/forgeflow-statusline.js', 'hooks/forgeflow-telemetry.js'): print(name)
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
"
```

Store as `DELETED_FILES`.

## Step 4 — Download Files

Ensure destination directories exist:
```bash
mkdir -p ~/.claude/agents ~/.claude/agents/_shared ~/.claude/commands ~/.claude/templates ~/.claude/hooks ~/.claude/project-rules ~/.claude/forgeflow-patterns
```

Raw base URL: `https://raw.githubusercontent.com/BrandedTamarasu-glitch/ForgeFlow/main/`

Skip any file in the `agents/` category whose destination basename starts with `custom-` — these are user-created agents that must never be overwritten.

For each file in `FILES_TO_SYNC`, download it to the matching destination. **For `agents/NAME.md` entries only: skip if NAME starts with `custom-`.**
- `agents/NAME.md` → `~/.claude/agents/NAME.md`  *(skip if NAME starts with `custom-`)*
- `agents/_shared/NAME.md` → `~/.claude/agents/_shared/NAME.md`
- `commands/NAME.md` → `~/.claude/commands/NAME.md`
- `commands/SUBDIR/NAME.md` → `~/.claude/commands/SUBDIR/NAME.md`  *(create `~/.claude/commands/SUBDIR/` if needed)*
- `project-rules/NAME.md` → `~/.claude/project-rules/NAME.md`
- `forgeflow-patterns/NAME.md` → `~/.claude/forgeflow-patterns/NAME.md`
- `templates/ship-presentation.html` → `~/.claude/templates/ship-presentation.html`
- `hooks/forgeflow-gate.js` → `~/.claude/hooks/forgeflow-gate.js`
- `hooks/forgeflow-context-monitor.js` → `~/.claude/hooks/forgeflow-context-monitor.js`
- `hooks/forgeflow-statusline.js` → `~/.claude/hooks/forgeflow-statusline.js`
- `hooks/forgeflow-telemetry.js` → `~/.claude/hooks/forgeflow-telemetry.js`

Use `curl -sf` with `-o` for each download. If any download fails (non-zero exit), report the failure and continue with the remaining files — do not abort the entire sync.

Set `HOOK_CHANGED=true` if `hooks/forgeflow-gate.js` was in `FILES_TO_SYNC`.

Track count of files successfully downloaded as `N`.

## Step 5 — Save Version

```bash
printf '%s\n' "$LATEST" > ~/.claude/forgeflow-version
```

## Step 6 — Report

**Standard report:**
```
Forgeflow updated  ($CURRENT_SHORT → $LATEST_SHORT)

Files synced (N):
  {file 1}
  {file 2}
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

</process>

<success_criteria>
- [ ] Fetches latest SHA from GitHub API — stops with clear message if unreachable
- [ ] Reads version from ~/.claude/forgeflow-version; exits cleanly if already up to date
- [ ] First run: downloads all tracked files via contents API (no prior version needed)
- [ ] Incremental: uses compare API to download only added/modified tracked files
- [ ] Tracked paths: agents/*.md (flat), agents/_shared/*.md, commands/*.md (flat), commands/*/*.md (one-level subdirs), project-rules/*.md (flat), templates/ship-presentation.html, hooks/forgeflow-gate.js, hooks/forgeflow-context-monitor.js, hooks/forgeflow-statusline.js, hooks/forgeflow-telemetry.js
- [ ] Commands in subdirectories (e.g. commands/agent-chat/on.md) sync to ~/.claude/commands/SUBDIR/NAME.md — subdir created if needed
- [ ] Never auto-deletes files from ~/.claude/ — deletions reported only
- [ ] Never overwrites files in ~/.claude/agents/ whose basename starts with `custom-`
- [ ] Never touches GSD agents or other non-Forgeflow files
- [ ] Individual download failures are reported but do not abort the sync
- [ ] Saves new SHA to ~/.claude/forgeflow-version after sync
- [ ] Summary lists every file synced with before/after SHAs
- [ ] Hook-changed warning appears when hooks/forgeflow-gate.js is in the diff
- [ ] No local clone required — works from curl alone
</success_criteria>
