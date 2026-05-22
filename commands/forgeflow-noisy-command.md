---
name: forgeflow-noisy-command
description: Advise on safer, narrower invocations for noisy development commands.
argument-hint: "[--command <cmd>] [--json]"
allowed-tools:
  - Bash
---

<objective>
Suggest narrower commands before large noisy outputs enter context. This is advisory only and never blocks exact output.
</objective>

<process>

Resolve helper:

```bash
HELPER_DIR="scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/advise-noisy-command.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/advise-noisy-command.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
```

If missing, stop with:

```text
Noisy-command advisor is not installed. Run /update-forgeflow, then retry /forgeflow-noisy-command.
```

Run:

```bash
"${HELPER_DIR}/advise-noisy-command.js" $ARGUMENTS
```

</process>

<success_criteria>
- [ ] Advisor flags known noisy invocations such as unbounded `find`, recursive listings, and broad test output
- [ ] Advisor returns pass for already narrow commands
- [ ] Advisor never compacts or hides command output
</success_criteria>
