---
name: forgeflow-code-map
description: Generate and print a compact project code map from Forgeflow topology, sections, and changed-section signals.
argument-hint: "[--json] [--out <markdown>] [--max-hotspots N]"
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Generate a user-facing project code map for the current repository. The map summarizes static JS/TS topology, fan-in/fan-out hotspots, source symbols with line ranges, Markdown headings, changed sections, and generated artifact paths.

Answers: "What does this project look like structurally, what files are central, and which changed sections should agents or maintainers inspect first?"
</objective>

<context>
$ARGUMENTS:
- `--json` — structured output instead of Markdown
- `--out <markdown>` — write the rendered summary to a custom path
- `--max-hotspots N` — number of fan-in/fan-out hotspots to keep

The command uses `scripts/forgeflow/show-code-map.js`, which writes:
- `.forgeflow/<project>/context/project-code-map.md`
- `.forgeflow/<project>/context/code-topology.json`
- `.forgeflow/<project>/context/code-topology-review-focus.md`
- `.forgeflow/<project>/context/code-topology-telemetry.json`
</context>

## Gotchas

- **Static map only.** This is not a runtime call graph, control-flow graph, data-flow graph, or dependency severity model.
- **JS/TS topology only.** Import edges are collected for `.js`, `.jsx`, `.ts`, and `.tsx`. Markdown headings are included as documentation sections.
- **Changed sections require a Git diff.** When there is no working-tree diff against `HEAD`, changed-section output is empty.
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

Pass through `--json`, `--out <markdown>`, and `--max-hotspots N` from `$ARGUMENTS`.

## Step 3: Render map

Run:

```bash
"${HELPER_DIR}/show-code-map.js" $ARGUMENTS
```

Print the helper output directly.

</process>

<success_criteria>
- [ ] The command prints a compact project code map or JSON summary
- [ ] Generated artifact paths are included
- [ ] Output states static-map limitations
- [ ] Missing helper produces an actionable update instruction
</success_criteria>
