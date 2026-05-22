---
name: forgeflow-adoption
description: Print a concise Forgeflow adoption pack with fit guidance, first-trial steps, proof boundaries, and decision rubric
argument-hint: "[--runtime claude-code|codex] [--project-name <name>] [--path maintainer|new-user] [--json]"
allowed-tools:
  - Bash
---
<objective>
Help a net-new user decide whether Forgeflow is worth trying by printing one concise adoption pack: why it exists, when it fits, when to wait, how to run the first trial, what evidence has already been recorded, the recommended next action, and how to decide the next step.
</objective>

<context>
$ARGUMENTS:
- `--runtime claude-code|codex` - render commands for the selected runtime. Default: `codex`.
- `--project-name <name>` - override the detected project name.
- `--path maintainer|new-user` - choose the maintainer pilot or first-real-task path. Default: `new-user`.
- `--json` - emit machine-readable output.
</context>

## Process

Use `scripts/forgeflow/render-adoption-pack.js`.

```bash
HELPER_DIR="scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/render-adoption-pack.js" ] && [ -f "$HOME/.claude/forgeflow/scripts/forgeflow/render-adoption-pack.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
```

If `${HELPER_DIR}/render-adoption-pack.js` is missing, stop with:

```text
Adoption pack helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-adoption.
```

Run:

Before Bash, parse `$ARGUMENTS` in the assistant layer. Accept only these flags:

- `--runtime` with `claude-code` or `codex`
- `--project-name` as plain text with shell metacharacters removed
- `--path` with `maintainer` or `new-user`
- `--json`

Reject unexpected flags or shell metacharacters instead of trying to escape them. Build `ARGS` only from validated values, never from raw `$ARGUMENTS`:

```bash
ARGS=()
# Append only validated values, for example:
# ARGS+=(--runtime "codex")
# ARGS+=(--project-name "My Project")
# ARGS+=(--path "new-user")
# ARGS+=(--json)
if [ -n "$VALIDATED_RUNTIME" ]; then ARGS+=(--runtime "$VALIDATED_RUNTIME"); fi
if [ -n "$VALIDATED_PATH" ]; then ARGS+=(--path "$VALIDATED_PATH"); fi
node "${HELPER_DIR}/render-adoption-pack.js" "${ARGS[@]}"
```

## Guardrails

- This prints a local decision aid; it does not install Forgeflow or run a pilot.
- If pilot evidence exists, the pack summarizes local rollup counts. It does not expose raw evidence files.
- Treat the proof boundary as part of the output, not a footnote.
- Do not ask the user to share raw `.forgeflow/` artifacts.
- If the user wants to proceed, route to `/forgeflow-pilot --path new-user` or the equivalent helper command.

## Success Criteria

- [ ] Output explains why Forgeflow is worth trying without overclaiming
- [ ] Output includes best-fit and not-fit-yet criteria
- [ ] Output includes first-trial steps and evidence to capture
- [ ] Output includes repeat, expand, stop-and-fix, and defer decision states
- [ ] Output includes privacy and proof-boundary reminders
