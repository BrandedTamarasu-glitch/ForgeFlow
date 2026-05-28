---
name: forgeflow-post-release-install-verify
description: Verify the installed Forgeflow runtime after a release or update
argument-hint: "[--json]"
allowed-tools:
  - Bash
---
<objective>
Show one read-only post-release install verdict across release verification, installed-version/runtime-drift consumability, and downstream smoke.
</objective>

<process>
Validate `$ARGUMENTS`. Only `--json` is supported.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/render-post-release-install-verify.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/render-post-release-install-verify.js" ]; then
  echo "Post-release install verifier is not installed. Run /update-forgeflow --repair, then retry /forgeflow-post-release-install-verify."
  exit 1
fi
SAFE_ARGS=(--root "${ROOT}" --install-root "$HOME/.claude")
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
for arg in "${USER_ARGS[@]}"; do
  case "$arg" in
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-post-release-install-verify"; exit 2 ;;
  esac
done
"${HELPER_DIR}/render-post-release-install-verify.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output includes release verify, install consumability, and downstream smoke.
- [ ] Output is read-only and never repairs installed files.
</success_criteria>
