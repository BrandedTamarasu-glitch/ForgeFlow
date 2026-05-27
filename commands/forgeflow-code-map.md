---
name: forgeflow-code-map
description: Generate and print a compact project code map from Forgeflow topology, sections, and changed-section signals.
argument-hint: "[--json] [--project-dir <dir>] [--out <markdown>] [--max-hotspots N] [--history-limit N]"
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Generate a user-facing project code map for the current repository. The map summarizes static JS/TS topology, fan-in/fan-out hotspots, source symbols with line ranges, Markdown headings, changed sections, import-gap explanations, Git provenance, previous-run trend deltas, and generated artifact paths.

Answers: "What does this project look like structurally, what files are central, and which changed sections should agents or maintainers inspect first?"
</objective>

<context>
$ARGUMENTS:
- `--json` — structured output instead of Markdown
- `--project-dir <dir>` — write generated `.forgeflow` context artifacts under a specific project directory
- `--out <markdown>` — write the rendered summary to a custom path
- `--max-hotspots N` — number of fan-in/fan-out hotspots to keep
- `--history-limit N` — number of recent code-map snapshots to retain (default: 50)

The command uses `scripts/forgeflow/show-code-map.js`, which writes:
- `.forgeflow/<project>/context/project-code-map.md`
- `.forgeflow/<project>/context/code-topology.json`
- `.forgeflow/<project>/context/code-topology-review-focus.md`
- `.forgeflow/<project>/context/code-topology-telemetry.json`
- `.forgeflow/<project>/context/code-map-history.jsonl`
- `.forgeflow/<project>/code-map-accept.json` (optional local-only input for exact accepted import gaps)
</context>

## Gotchas

- **Static map only.** This is not a runtime call graph, control-flow graph, data-flow graph, or dependency severity model.
- **JS/TS topology only.** Import edges are collected for `.js`, `.jsx`, `.ts`, and `.tsx`. Markdown headings are included as documentation sections.
- **Changed sections require a Git diff.** When there is no working-tree diff against `HEAD`, changed-section output is empty.
- **Provenance is Git-based.** Branch, commit, dirty state, changed-file count, and untracked-file count are recorded when the helper runs from the repository root.
- **Trends are local history.** Trend deltas compare against the previous compact snapshot in `.forgeflow/<project>/context/code-map-history.jsonl`; the helper retains the latest 50 snapshots by default.
- **Import gaps are triage hints.** Unresolved imports and skipped dynamic imports are shown with likely reason/action text, but they are not proof of broken runtime behavior.
- **Accepted gaps are local-only.** Add exact `{source, specifier}` or `{source, expression}` entries to `.forgeflow/<project>/code-map-accept.json` only for known intentional gaps. Accepted gaps stay visible, stale acceptances are reported, and acceptance is not proof of runtime correctness.
- **Line ranges are hints.** They are computed from static section starts and the next section boundary.

<process>

## Step 1: Resolve helper

```bash
HELPER_DIR="scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/show-code-map.js" ] && [ -x "$HOME/.claude/forgeflow/scripts/forgeflow/show-code-map.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
```

If `${HELPER_DIR}/show-code-map.js` is missing, stop with:

```text
Code map helper is not installed. Run /update-forgeflow, then retry /forgeflow-code-map.
```

## Step 2: Build arguments

Before Bash, parse `$ARGUMENTS` in the assistant layer. Accept only `--json`, `--project-dir <dir>`, `--out <markdown>`, `--max-hotspots N`, and `--history-limit N`. Reject unexpected flags or shell metacharacters. Build `ARGS` only from validated values.

## Step 3: Render map

Run:

```bash
ARGS=()
# Append only validated values for the supported flags.
if [ -n "$VALIDATED_MAX_HOTSPOTS" ]; then ARGS+=(--max-hotspots "$VALIDATED_MAX_HOTSPOTS"); fi
if [ "$WANTS_JSON" = "true" ]; then ARGS+=(--json); fi
"${HELPER_DIR}/show-code-map.js" "${ARGS[@]}"
```

Print the helper output directly.

</process>

<success_criteria>
- [ ] The command prints a compact project code map or JSON summary
- [ ] Generated artifact paths are included
- [ ] Output includes provenance metadata
- [ ] Output includes local code-map trend metadata
- [ ] Output explains unresolved and dynamic import gaps when present
- [ ] Output states static-map limitations
- [ ] Missing helper produces an actionable update instruction
</success_criteria>
