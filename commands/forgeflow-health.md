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
- **Checks current cwd's `.forgeflow/` state only inside a git worktree.** If run outside a git repo, skip project-local checks and say exactly which cwd was skipped. Do not count that skip as a failure.
- **Version drift check is best-effort.** Compares `~/.claude/forgeflow-version` to the latest upstream SHA via `curl` to GitHub. If offline, skips the check with a note.
- **Restart state is inferred from disk checks.** If health passes on disk but a slash command or hook behavior is unavailable in the current Claude session, tell the user to restart Claude Code to reload commands/hooks.
- **Does not validate agent file semantics.** Only checks that files exist and have valid frontmatter — does not verify prompts are coherent or up to date. For that, run the Forgeflow on the agent files themselves via `/review agents/*.md`.
- **Custom agent detection.** Files under `~/.claude/agents/` starting with `custom-` are NOT expected; they're user-created. Only the canonical Forgeflow agents and shared reference files are required.

<process>

## Step 1: Expected inventory

```bash
EXPECTED_AGENTS=(
  aegis
  compass-discuss compass-research compass-plan compass-implement compass-review compass-present
  smith-consult smith-implement smith-audit smith-review
  warden-consult warden-implement warden-audit warden-review
  arbiter-consult arbiter-implement arbiter-review
  atlas-early atlas-consult atlas-implement atlas-review atlas-present
  lumen-consult lumen-implement lumen-review
)
EXPECTED_SHARED_AGENT_FILES=(
  arbiter-intelligence lumen-design-principles rules smith-craft warden-security-intelligence
)
EXPECTED_COMMANDS=(
  audit ci-wrapper consult create-agent dashboard debate discuss fleet
  forgeflow-adoption forgeflow-code-map forgeflow-command-args forgeflow-command-wrapper-batch forgeflow-compact-output forgeflow-context-advisor forgeflow-context-contract forgeflow-context-retention forgeflow-context-wave-build forgeflow-context-wave-plan forgeflow-capture-output forgeflow-drift forgeflow-efficiency-gaps forgeflow-failure-digest forgeflow-first-run forgeflow-first-run-result forgeflow-first-run-rollup forgeflow-first-task-adoption-loop forgeflow-first-task-report forgeflow-first-useful-win forgeflow-health forgeflow-health-timeline forgeflow-insight-injection forgeflow-learning-policy forgeflow-learning-status forgeflow-learnings forgeflow-metrics forgeflow-next-action-audit forgeflow-next-work-outcome forgeflow-next-work-ranking forgeflow-noisy-command forgeflow-output-contract forgeflow-outcome-capture-plan forgeflow-pattern-review forgeflow-pilot forgeflow-post-release-install-verify forgeflow-profile forgeflow-profile-bootstrap forgeflow-profile-review forgeflow-release-check forgeflow-release-follow-through forgeflow-release-readiness forgeflow-release-verify forgeflow-repair forgeflow-report forgeflow-review-auto-classify forgeflow-review-auto-evidence forgeflow-review-evidence-schema forgeflow-review-wave-prep forgeflow-runtime-drift forgeflow-smoke forgeflow-stale-artifact-plan forgeflow-support forgeflow-sync forgeflow-telemetry-quality forgeflow-trends forgeflow-update-verify forgeflow-validation-failure-capture forgeflow-validation-plan forgeflow-version forgeflow-workflow-ending-capture
  handoff implement plan quick research review review-auto ship sync-upstream ui-iterate update-forgeflow
)
EXPECTED_SUBDIR_COMMANDS=(agent-chat/on agent-chat/off)
EXPECTED_PROJECT_RULES=(commit-hygiene dev-environment)
EXPECTED_HOOKS=(forgeflow-gate forgeflow-context-monitor forgeflow-statusline forgeflow-telemetry)
EXPECTED_TEMPLATES=(ship-presentation.html)
EXPECTED_RUNTIME_HELPERS=(
  advise-context.js advise-noisy-command.js agent-chat-off.sh agent-chat-on.sh build-code-topology.js build-context-pack.js build-context-wave.js build-failure-digest.js build-memory-context.js build-project-intelligence.js
  build-scope-manifest.js capture-command-output.js check-agent-drift.js check-codex-agent-drift.js check-context-contract.js check-context-budget.js check-implementation-notes.js check-profile-compliance.js check-project-learnings.js check-review-evidence-schema.js check-user-profile.js classify-review-auto.js command-args.js command-wrapper-contract.js context-telemetry.js learning-signal-policy.js
  compact-command-output.js
  ensure-forgeflow-state.sh explain-review-route.js failure-digest-triage.js file-safety.js forgeflow-version.js generate-codex-agent-stubs.js guidance-contract.js health-check.js
  index-memory.js install-manifest.js install-template.js latest-insights-state.js next-action-contract.js output-contract.js privacy-boundary.js record-agent-feedback.js record-first-run-result.js record-implementation-notes.js record-next-work-outcome.js record-pilot-evidence.js record-project-learning.js record-review-outcome.js record-user-profile.js render-adoption-pack.js render-command-index.js render-command-wrapper-batch.js render-context-retention.js render-context-wave-plan.js render-efficiency-gap-plan.js render-evaluation-report.js render-first-run-guide.js render-first-task-adoption-loop.js render-first-task-report.js render-first-useful-win.js render-forgeflow-report.js render-guided-repair.js render-insight-injection.js render-next-work-ranking.js render-outcome-capture-plan.js render-pattern-review.js render-post-release-install-verify.js render-profile-bootstrap.js render-profile-review.js render-review-auto-evidence.js render-review-wave-prep.js render-release-follow-through.js render-release-notes.js render-release-readiness.js render-release-verify.js render-pilot-script.js render-ship-presentation.js render-telemetry-quality.js render-workflow-ending-capture.js
  rollup-agent-feedback.js rollup-first-run-results.js rollup-pattern-learnings.js rollup-pilot-evidence.js rollup-project-learnings.js runtime-drift-snapshot.js runtime-helper-contract.js runtime-inventory.js seed-budget-config.js show-code-map.js show-project-health-timeline.js show-learning-status.js show-project-learnings.js show-project-trends.js ship-ci-status.sh ship-open-pr.sh ship-prepare.sh summarize-calibration.js render-support-bundle.js
  smoke-check.js summarize-context-telemetry.js update-forgeflow.js render-stale-artifact-plan.js render-update-verify.js render-validation-failure-capture.js render-validation-plan.js show-user-profile.js user-profile.js
)
```

## Step 2: Run checks

### 2a. Agent files
For each agent in `EXPECTED_AGENTS`:
- Check `~/.claude/agents/<agent>.md` exists and is a regular file
- Check frontmatter parses (first `---` line, name field, description field)

For each shared reference file in `EXPECTED_SHARED_AGENT_FILES`:
- Check `~/.claude/agents/_shared/<file>.md` exists and is a regular file

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
- For wiring drift, print the exact manual JSON snippet or command string. Never say only "see docs."

Manual statusline fix snippet:

```json
"statusLine": {
  "type": "command",
  "command": "node \"/home/corye/.claude/hooks/forgeflow-statusline.js\""
}
```

Manual PostToolUse hook snippets:

```json
{
  "hooks": [
    {
      "type": "command",
      "command": "node \"/home/corye/.claude/hooks/forgeflow-context-monitor.js\""
    }
  ]
}
```

```json
{
  "hooks": [
    {
      "type": "command",
      "command": "node \"/home/corye/.claude/hooks/forgeflow-gate.js\""
    }
  ]
}
```

```json
{
  "hooks": [
    {
      "type": "command",
      "command": "node \"/home/corye/.claude/hooks/forgeflow-telemetry.js\""
    }
  ]
}
```

### 2e. Settings.json validity
```bash
jq empty ~/.claude/settings.json 2>&1 || echo "INVALID JSON"
```

### 2e.0. Templates
For each template in `EXPECTED_TEMPLATES`:
- Check `~/.claude/templates/<template>` exists and is a regular file
When the installed helper is available, `scripts/forgeflow/health-check.js --install-root ~/.claude --json` can run the template and runtime-helper portions from the manifest-backed helper list.

### 2e.1. Runtime helpers
For each helper in `EXPECTED_RUNTIME_HELPERS`:
- Check `~/.claude/forgeflow/scripts/forgeflow/<helper>` exists
- For `.js` helpers, check `node --check` succeeds when node is available
- For `.sh` helpers, check `bash -n` succeeds
When the installed helper is available, `scripts/forgeflow/health-check.js --install-root ~/.claude --json` can run the runtime-helper portion from the manifest-backed helper list.

### 2f. Project-local state (if cwd is a repo)
- First run `git rev-parse --is-inside-work-tree`.
- If not inside a git worktree, mark project-local state as `skipped`, not failed. Output:
  - `Project-local .forgeflow/: skipped`
  - `Reason: cwd <path> is not inside a git worktree`
  - `Next: cd into a git project, then rerun /forgeflow-health --fix`
- `.forgeflow/<project-name>/` directory exists
- `.forgeflow/<project-name>/agent-notes/` exists
- `.forgeflow/` is in `.gitignore`
- Optional `.forgeflow-budget.json` exists when context budgets should be project-specific.
- If `.forgeflow/<project-name>/ship/implementation-notes-check.json` exists, report its latest status, warning count, failure count, and report path. This is informational; do not fail health solely because the latest notes check was a warning or failure.
- If `.forgeflow/<project-name>/pilot-evidence-rollup.md` exists, report its pilot count, decision, next fix layer, and report path. This is informational; do not fail health solely because the rollup recommends a product fix.
- If `.forgeflow/<project-name>/context/latest/latest-insights-report.json` exists, report whether latest project insights were `injected`, `blocked`, `missing`, or errored, including quality-gate status, issue count, and freshness against the current HEAD/dirty state. When freshness is stale, recommend `/forgeflow-trends --refresh`; when the insight gate is blocked or invalid, recommend `/forgeflow-learnings --project --check`.
- Resolve `HELPER_DIR` to `scripts/forgeflow` when present, otherwise `$HOME/.claude/forgeflow/scripts/forgeflow`.
- When available, run `${HELPER_DIR}/health-check.js --json` for a machine-readable project-local report.
- If `--fix` is set, run `${HELPER_DIR}/health-check.js --fix --json` to create safe local scaffolding and seed `.forgeflow-budget.json` without overwriting an existing config.

### 2g. Version drift
Prefer the installed `/forgeflow-version` helper when present because it reports local paths and latest release in addition to upstream drift:

```bash
HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
if [ -f "${HELPER_DIR}/forgeflow-version.js" ]; then
  env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/forgeflow-version.js" --json
else
  echo "Forgeflow version helper is missing. Run /update-forgeflow --repair after this health check."
fi
```

If the helper is unavailable, fall back to:

```bash
CURRENT=$(cat ~/.claude/forgeflow-version 2>/dev/null)
LATEST=$(curl -sf "https://api.github.com/repos/BrandedTamarasu-glitch/ForgeFlow/commits/main" 2>/dev/null \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['sha'])" 2>/dev/null)
```
If `CURRENT` != `LATEST` and both are valid SHAs, report as "Outdated — run /update-forgeflow".

### 2h. gh auth state (if `gh` is installed)
```bash
gh auth status 2>&1 | grep "Logged in" | head -5
```
Report the active account. Warn if pushing to `BrandedTamarasu-glitch/ForgeFlow` requires a different account than currently active.

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
      Fix: add this entry under hooks.PostToolUse in ~/.claude/settings.json:
      {"hooks":[{"type":"command","command":"node \"/home/corye/.claude/hooks/forgeflow-telemetry.js\""}]}
- [ ] settings.json statusLine: points to gsd-statusline.js, not forgeflow-statusline.js
      Fix: set statusLine.command to:
      node "/home/corye/.claude/hooks/forgeflow-statusline.js"
- [ ] Outdated: local at abc1234, latest at def5678 (3 commits behind)
      Fix: /update-forgeflow

## Passing
- Agents: 28/29
- Commands: 20/20
- Project rules: 2/2
- Hooks: 3/4 installed, 3/4 wired
- Settings.json: valid
- Runtime helpers: 26/26
- Current project (.forgeflow/): 3/3
- Project-local .forgeflow/: skipped — cwd /path is not inside a git worktree

Summary: 4 failures, 28 passing. Run /forgeflow-health --fix to auto-repair safe items.
```

With `--verbose`: include PASSING lines for every check.

## Step 4: Auto-fix (if `--fix` flag set)

Safe auto-fixes:
- Create missing dirs: `.forgeflow/<project>/agent-notes/`
- Add `.forgeflow/` to `.gitignore` if missing
- Seed `.forgeflow-budget.json` from the bundled template if missing

Prefer `${HELPER_DIR}/health-check.js --fix --json` for project-local fixes. It reports each path it changed and leaves existing budget config untouched.

Never auto-fix:
- Missing agents or commands → directs to `/update-forgeflow`
- settings.json changes → prints exact manual JSON snippet
- Version drift → directs to `/update-forgeflow`
- gh auth → directs to `gh auth switch`

After auto-fix, re-run all checks and report remaining failures.

</process>

<success_criteria>
- [ ] Every agent, command, project-rule, hook, and template checked against expected inventory
- [ ] Missing files reported with concrete fix instructions (which command to run)
- [ ] Settings.json JSON validity verified
- [ ] Project-local .forgeflow/ state audited when in a repo, skipped without failure outside a repo
- [ ] Hook/statusline wiring failures include exact manual settings snippets
- [ ] Installed-but-not-loaded cases tell the user to restart Claude Code
- [ ] Version drift detected against upstream SHA
- [ ] gh auth state reported for push clarity
- [ ] Auto-fix never mutates settings.json
- [ ] Default output is failure-focused; --verbose includes passes
</success_criteria>
