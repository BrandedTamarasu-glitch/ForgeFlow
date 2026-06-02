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
Create `.forgeflow/<project>/context/latest/failure-digest.md` or a caller-specified digest file that preserves failure evidence while trimming noisy passing/progress output. The digest records Git provenance so trends, reports, health, smoke, and context packets can warn when it is stale for the current checkout.
</objective>

<process>

Resolve helper:

```bash
HELPER_DIR="scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/build-failure-digest.js" ] && [ -f "$HOME/.claude/forgeflow/scripts/forgeflow/build-failure-digest.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
```

If missing, stop with:

```text
Failure-digest helper is not installed. Run /update-forgeflow, then retry /forgeflow-failure-digest.
```

Run:

```bash
ARGS=()
# Append only validated values for --mode, --command, --file, --out, and --json.
if [ -n "$VALIDATED_MODE" ]; then ARGS+=(--mode "$VALIDATED_MODE"); fi
if [ -n "$VALIDATED_COMMAND" ]; then ARGS+=(--command "$VALIDATED_COMMAND"); fi
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/build-failure-digest.js" "${ARGS[@]}"
```

</process>

<success_criteria>
- [ ] Digest includes mode, raw-required status, omitted-line count, and compact output
- [ ] Digest includes Git provenance for freshness checks
- [ ] File/line evidence references are preserved when detected
- [ ] Unsafe command output is kept raw and labeled raw-required
</success_criteria>
