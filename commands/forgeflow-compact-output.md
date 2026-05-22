---
name: forgeflow-compact-output
description: Compact allowlisted noisy command output without touching correctness-critical output.
argument-hint: "--mode <test|typecheck|lint|logs|grep|json|status|tree> --command <cmd> [--file <path>] [--json]"
allowed-tools:
  - Read
  - Bash
---

<objective>
Compact human-narrative command output while preserving exact output for diffs, patches, SHAs, exact file lists, and other correctness-critical command classes.
</objective>

<context>
Use this only for noisy output that is safe to summarize: test logs, typecheck/build output, lint output, logs, grep output, compact status/listing output, or JSON shape inspection.

Never use this to compact a patch, diff, SHA list, exact file list, or output intended for another tool.

`--command` is required. Without the original command string, Forgeflow cannot detect unsafe exact-output classes and will preserve raw output.
</context>

<process>

Resolve helper:

```bash
HELPER_DIR="scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/compact-command-output.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/compact-command-output.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
```

If missing, stop with:

```text
Compact-output helper is not installed. Run /update-forgeflow, then retry /forgeflow-compact-output.
```

Run:

```bash
ARGS=()
# Append only validated values for --mode, --command, --file, and --json.
if [ -n "$VALIDATED_MODE" ]; then ARGS+=(--mode "$VALIDATED_MODE"); fi
if [ -n "$VALIDATED_COMMAND" ]; then ARGS+=(--command "$VALIDATED_COMMAND"); fi
"${HELPER_DIR}/compact-command-output.js" "${ARGS[@]}"
```

</process>

<success_criteria>
- [ ] Unsafe commands pass through raw output
- [ ] Missing `--command` passes through raw output
- [ ] Parse failures return raw output with an explicit reason
- [ ] Nonempty input never becomes silent empty output
- [ ] Compacted output states omitted-line counts in JSON mode
</success_criteria>
