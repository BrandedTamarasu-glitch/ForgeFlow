---
name: forgeflow-health
description: Audit Forgeflow installation integrity — agent files, commands, hooks, project-rules, and project-local Forgeflow state
argument-hint: "[--fix] [--verbose]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---
<objective>
Checklist-style integrity audit of the Forgeflow installation. Catches drift when agent files are deleted, hooks lose their wiring, `/update-forgeflow` hasn't run recently, or a project is missing its `.forgeflow/` scaffolding.

Answers: "Is the Forgeflow team actually installed correctly?" Replaces ad-hoc troubleshooting when something stops working.
</objective>

<context>
$ARGUMENTS:
- `--fix` — attempt to auto-repair safe issues (create missing dirs, add `.forgeflow/` to `.gitignore`). Never touches `settings.json` — prompts user for manual fix.
- `--verbose` — include passing checks in output, not just failures.

No arguments: shows only failures, summary pass/fail count.
</context>

## Gotchas
- **Never modifies settings.json.** Hook wiring issues are reported but user fixes them manually — settings.json is too load-bearing to mutate silently.
- **Checks current cwd's `.forgeflow/` state.** If run outside any project, skips project-local checks with a note.
- **Version drift check is best-effort.** Compares `~/.claude/forgeflow-version` to the latest upstream SHA via `curl` to GitHub. If offline, skips the check with a note.
- **Does not validate agent file semantics.** Only checks that files exist and have valid frontmatter — does not verify prompts are coherent or up to date. For that, run the Forgeflow on the agent files themselves via `/review agents/*.md`.
- **Custom agent detection.** Files under `~/.claude/agents/` starting with `custom-` are NOT expected; they're user-created. Only the 25 canonical Forgeflow agents are required.

<process>

## Step 1: Expected inventory

```bash
EXPECTED_AGENTS=(
  compass-discuss compass-research compass-plan compass-implement compass-review compass-present
  smith-consult smith-implement smith-audit smith-review smith-craft
  warden-consult warden-implement warden-audit warden-review warden-security-intelligence
  arbiter-consult arbiter-implement arbiter-review arbiter-intelligence
  atlas-early atlas-consult atlas-implement atlas-review atlas-present
  lumen-consult lumen-implement lumen-review lumen-design-principles
)
EXPECTED_COMMANDS=(
  discuss research plan consult implement review review-auto ship fleet ui-iterate
  handoff audit quick create-agent sync-upstream update-forgeflow
  debate debate-false-positive forgeflow-metrics forgeflow-health
)
EXPECTED_SUBDIR_COMMANDS=(agent-chat/on agent-chat/off)
EXPECTED_PROJECT_RULES=(commit-hygiene dev-environment)
EXPECTED_HOOKS=(forgeflow-gate forgeflow-context-monitor forgeflow-statusline forgeflow-telemetry)
EXPECTED_TEMPLATES=(ship-presentation.html)
```

## Step 2: Run checks

### 2a. Agent files
For each agent in `EXPECTED_AGENTS`:
- Check `~/.claude/agents/<agent>.md` exists and is a regular file
- Check frontmatter parses (first `---` line, name field, description field)

### 2b. Commands
For each command in `EXPECTED_COMMANDS` and `EXPECTED_SUBDIR_COMMANDS`:
- Check `~/.claude/commands/<command>.md` exists
- Check frontmatter parses

### 2c. Project rules
For each rule in `EXPECTED_PROJECT_RULES`:
- Check `~/.claude/project-rules/<rule>.md` exists

### 2d. Hooks
For each hook in `EXPECTED_HOOKS`:
- Check `~/.claude/hooks/<hook>.js` exists
- Check it's referenced in `~/.claude/settings.json` (grep for the filename)

### 2e. Settings.json validity
```bash
jq empty ~/.claude/settings.json 2>&1 || echo "INVALID JSON"
```

### 2f. Project-local state (if cwd is a repo)
- `.forgeflow/<project-name>/` directory exists
- `.forgeflow/<project-name>/agent-notes/` exists
- `.forgeflow/` is in `.gitignore`

### 2g. Version drift
```bash
CURRENT=$(cat ~/.claude/forgeflow-version 2>/dev/null)
LATEST=$(curl -sf "https://api.github.com/repos/ForgeflowAI/Forgeflow/commits/main" 2>/dev/null \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['sha'])" 2>/dev/null)
```
If `CURRENT` != `LATEST` and both are valid SHAs, report as "Outdated — run /update-forgeflow".

### 2h. gh auth state (if `gh` is installed)
```bash
gh auth status 2>&1 | grep "Logged in" | head -5
```
Report the active account. Warn if pushing to `ForgeflowAI/Forgeflow` requires a different account than currently active.

## Step 3: Report

Default (without `--verbose`):
```markdown
# Forgeflow — Health Check

## Failures (<count>)

- [ ] MISSING: `~/.claude/agents/compass-plan.md`
      Fix: /update-forgeflow
- [ ] MISSING: `~/.claude/hooks/forgeflow-telemetry.js`
      Fix: /update-forgeflow
- [ ] settings.json hook: forgeflow-telemetry.js not referenced in PostToolUse
      Fix: add the hook entry manually (see Review Hook wiki page)
- [ ] Outdated: local at abc1234, latest at def5678 (3 commits behind)
      Fix: /update-forgeflow

## Passing
- Agents: 28/29
- Commands: 20/20
- Project rules: 2/2
- Hooks: 3/4 installed, 3/4 wired
- Settings.json: valid
- Current project (.forgeflow/): 3/3

Summary: 4 failures, 28 passing. Run /forgeflow-health --fix to auto-repair safe items.
```

With `--verbose`: include PASSING lines for every check.

## Step 4: Auto-fix (if `--fix` flag set)

Safe auto-fixes:
- Create missing dirs: `.forgeflow/<project>/agent-notes/`
- Add `.forgeflow/` to `.gitignore` if missing

Never auto-fix:
- Missing agents or commands → directs to `/update-forgeflow`
- settings.json changes → directs user to Review Hook wiki
- Version drift → directs to `/update-forgeflow`
- gh auth → directs to `gh auth switch`

After auto-fix, re-run all checks and report remaining failures.

</process>

<success_criteria>
- [ ] Every agent, command, project-rule, hook, and template checked against expected inventory
- [ ] Missing files reported with concrete fix instructions (which command to run)
- [ ] Settings.json JSON validity verified
- [ ] Project-local .forgeflow/ state audited when in a repo
- [ ] Version drift detected against upstream SHA
- [ ] gh auth state reported for push clarity
- [ ] Auto-fix never mutates settings.json
- [ ] Default output is failure-focused; --verbose includes passes
</success_criteria>
