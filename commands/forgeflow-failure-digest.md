---
name: forgeflow-failure-digest
description: Build a compact failure digest from test, typecheck, lint, or log output.
argument-hint: "--mode <test|typecheck|lint|logs> [--command <cmd>] [--file <path>] [--out <path>] [--json]"
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Create `.forgeflow/<project>/context/latest/failure-digest.md` or a caller-specified digest file that preserves failure evidence while trimming noisy passing/progress output.
</objective>

<process>

Resolve helper:

```bash
HELPER_DIR="scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/build-failure-digest.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/build-failure-digest.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
```

If missing, stop with:

```text
Failure-digest helper is not installed. Run /update-forgeflow, then retry /forgeflow-failure-digest.
```

Run:

```bash
"${HELPER_DIR}/build-failure-digest.js" $ARGUMENTS
```

</process>

<success_criteria>
- [ ] Digest includes mode, raw-required status, omitted-line count, and compact output
- [ ] File/line evidence references are preserved when detected
- [ ] Unsafe command output is kept raw and labeled raw-required
</success_criteria>
