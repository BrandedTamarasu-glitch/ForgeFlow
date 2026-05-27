---
name: forgeflow-release-verify
description: Print the compact local post-publish release verification summary
argument-hint: "[--save] [--compare-last] [--json]"
allowed-tools:
  - Bash
---
<objective>
Show the shareable local post-publish verification summary for the current Forgeflow checkout. This command is release-safe: it does not tag, push, publish, call GitHub, or mutate installed files. With `--save`, it writes only the local post-publish snapshot.
</objective>

<context>
$ARGUMENTS:
- `--save` - save `.forgeflow/<project>/release-readiness/post-publish-last.json`.
- `--compare-last` - compare current local post-publish evidence with the saved snapshot.
- `--json` - structured output.
</context>

<process>
Validate `$ARGUMENTS`. Accept only `--save`, `--compare-last`, and `--json`; reject every other flag or shell metacharacter.

Resolve helper:

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-release-verify.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-release-verify.js" ]; then
  echo "Release verify helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-release-verify."
  exit 1
fi
cd "${ROOT}"
```

Build an argv array from validated arguments and run:

```bash
SAFE_ARGS=()
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --save) SAFE_ARGS+=(--save) ;;
    --compare-last) SAFE_ARGS+=(--compare-last) ;;
    --json) SAFE_ARGS+=(--json) ;;
    *) echo "Unsupported arguments for /forgeflow-release-verify"; exit 2 ;;
  esac
done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-release-verify.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output includes version, tag, HEAD, shareable summary, evidence, and next command.
- [ ] Output states that verification is local, advisory, and release-safe.
</success_criteria>
