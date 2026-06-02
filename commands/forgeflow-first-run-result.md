---
name: forgeflow-first-run-result
description: Record a local public-safe first-run trial result for onboarding learning
argument-hint: "--runtime claude-code|codex --health pass|warn|fail --smoke pass|warn|fail [--profile pass|warn|fail] --decision continue|fix-first|stop-and-fix|defer [--friction <category>] [--next-action <text>] [--notes <text>] [--json]"
allowed-tools:
  - Bash
---
<objective>
Record the outcome of a net-new user first-run path into local project Forgeflow artifacts. This is for onboarding trend evidence, not release proof.
</objective>

<context>
$ARGUMENTS supports:
- `--runtime claude-code|codex`
- `--health pass|warn|fail`
- `--smoke pass|warn|fail`
- `--profile pass|warn|fail`
- `--decision continue|fix-first|stop-and-fix|defer`
- `--friction install|health|settings|template-installer|codex-discovery|agent-routing|context-budget|review-quality|privacy|docs|first-review-blocked|repeated-support-category`
- `--next-action <public-safe text>`
- `--notes <public-safe text>`
- `--json`
</context>

<process>
Before Bash, validate `$ARGUMENTS` and build an argv array. Reject unknown flags, shell metacharacters, and private or sensitive text. Do not pass raw unvalidated arguments to the shell.

Resolve helper:

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "${ROOT}")"
FORGEFLOW_DIR="${ROOT}/.forgeflow/${PROJECT_NAME}"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/record-first-run-result.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -f "${HELPER_DIR}/record-first-run-result.js" ]; then
  echo "First-run result helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-first-run-result."
  exit 1
fi
```

Run the helper with validated arguments:

```bash
SAFE_ARGS=(--project-dir "${FORGEFLOW_DIR}")
# Append only validated flags and values to SAFE_ARGS.
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/record-first-run-result.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Result is saved under `.forgeflow/<project>/first-run-results/`.
- [ ] Notes and next action remain public-safe and contain no secrets, private URLs, customer names, or source snippets.
</success_criteria>
