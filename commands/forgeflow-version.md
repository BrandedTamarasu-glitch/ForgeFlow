---
name: forgeflow-version
description: Show installed Forgeflow version, upstream status, release tag, helper paths, and next update action
argument-hint: "[--json] [--offline]"
allowed-tools:
  - Bash
---
<objective>
Report the installed Forgeflow commit and compare it with upstream `main`. Use this when a user asks "what version is installed?", "do I need to update?", "which helper path is active?", or "did Claude pick up the latest Forgeflow install?"
</objective>

<context>
$ARGUMENTS:
- `--json` — emit machine-readable helper output.
- `--offline` — skip GitHub lookups and report local install paths only.
</context>

<process>

## Step 1: Resolve Helper

Prefer the repo-local helper when present; otherwise use the installed helper:

```bash
HELPER_DIR="scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/forgeflow-version.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/forgeflow-version.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
```

If neither helper exists, report:

```text
Forgeflow version helper is not installed yet.
Run /update-forgeflow, or from a local checkout run:
scripts/forgeflow/update-forgeflow.js
```

## Step 2: Run Helper

```bash
"${HELPER_DIR}/forgeflow-version.js" $ARGUMENTS
```

## Step 3: Interpret

- `up-to-date` — installed commit matches upstream `main`.
- `outdated` — run `/update-forgeflow`, then restart Claude Code if commands or hooks changed.
- `not-installed` — run `/update-forgeflow`; if that command is unavailable, run `scripts/forgeflow/update-forgeflow.js` from a local checkout.
- `corrupt-version` — delete `~/.claude/forgeflow-version`, then run `/update-forgeflow`.
- `installed-unknown-upstream` — local install exists, but GitHub could not be reached for comparison.

</process>

<success_criteria>
- [ ] Reports installed SHA from `~/.claude/forgeflow-version`
- [ ] Reports upstream `main` SHA when online
- [ ] Reports latest GitHub release tag when available
- [ ] Reports installed helper and command paths
- [ ] Gives exactly one concrete next action
</success_criteria>
