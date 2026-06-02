---
name: forgeflow-profile
description: Show, check, or record local user operating and project experience preferences
argument-hint: "[--check] [--record --scope global|project --category <category> --preference <text> ...] [--json]"
allowed-tools:
  - Bash
---
<objective>
Manage Forgeflow's local advisory user profile. The global profile captures how the user likes Forgeflow to operate across projects. The project profile captures how this project should look, feel, and speak.
</objective>

<context>
$ARGUMENTS:
- `--check` — run the profile quality/privacy gate.
- `--record` — append a structured preference. Requires `--scope`, `--category`, and `--preference`.
- `--scope global|project` — global user operating profile or project experience profile.
- `--category communication|autonomy|risk|validation|release|docs|review|workflow|ui|product-copy|accessibility`
- `--preference <text>` — concise preference text.
- `--evidence <text>` — why this preference is recorded.
- `--confidence low|medium|high`
- `--evidence-count <n>`
- `--source explicit-user-instruction|repeated-user-behavior|user-correction|accepted-workflow|inferred`
- `--applies-to <comma,list>`
- `--agent-guidance <text>`
- `--json` — structured output.
</context>

<process>

Resolve helpers:

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/show-user-profile.js" ] || [ ! -x "${HELPER_DIR}/check-user-profile.js" ] || [ ! -x "${HELPER_DIR}/record-user-profile.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/show-user-profile.js" ] || [ ! -x "${HELPER_DIR}/check-user-profile.js" ] || [ ! -x "${HELPER_DIR}/record-user-profile.js" ]; then
  echo "User profile helper is not installed. Run /update-forgeflow, then retry /forgeflow-profile."
  exit 1
fi
```

If any profile helper is missing, stop with:

```text
User profile helper is not installed. Run /update-forgeflow, then retry /forgeflow-profile.
```

For `--record`, pass only validated arguments to `record-user-profile.js`:

```bash
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/record-user-profile.js" --project-dir "${FORGEFLOW_DIR}" <validated args>
```

For `--check`, run:

```bash
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/check-user-profile.js" --project-dir "${FORGEFLOW_DIR}"
```

Otherwise show the compact profile:

```bash
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/show-user-profile.js" --project-dir "${FORGEFLOW_DIR}"
```

## Boundaries

- The global profile is local machine state under `~/.claude/forgeflow/`.
- The project profile is local project state under `.forgeflow/<project>/`.
- Preferences are advisory only. They never override explicit current-turn instructions, correctness, security, accessibility, validation evidence, or product judgment.
- Do not record secrets, private URLs, source snippets, customer names, raw settings, or project-specific details into the global profile.

</process>

<success_criteria>
- [ ] Profile output clearly separates global user operating preferences from project experience preferences.
- [ ] `--check` reports privacy or schema issues before profile guidance is injected into context packs.
- [ ] `--record` writes only structured, bounded, local preference entries.
</success_criteria>
