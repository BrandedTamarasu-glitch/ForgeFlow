---
name: forgeflow-command-args
description: Validate a Forgeflow command argument string against an explicit allowlist
argument-hint: "--allow <flags> [--args \"...\"] [--json]"
allowed-tools:
  - Bash
---
<objective>
Validate a small Forgeflow command argument subset before a wrapper forwards it to a runtime helper.
</objective>

<process>
Validate `$ARGUMENTS`. Accept only `--allow`, `--args`, and `--json`.

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HELPER_DIR="${ROOT}/scripts/forgeflow"
if [ ! -x "${HELPER_DIR}/command-args.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi
if [ ! -x "${HELPER_DIR}/command-args.js" ]; then
  echo "Command argument helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-command-args."
  exit 1
fi
SAFE_ARGS=()
read -r -a USER_ARGS <<< "${ARGUMENTS:-}"
idx=0
while [ "${idx}" -lt "${#USER_ARGS[@]}" ]; do
  arg="${USER_ARGS[$idx]}"
  case "$arg" in
    --allow|--args)
      idx=$((idx + 1))
      value="${USER_ARGS[$idx]:-}"
      if [ -z "${value}" ]; then echo "Missing value for ${arg}"; exit 2; fi
      SAFE_ARGS+=("${arg}" "${value}")
      ;;
    --json) SAFE_ARGS+=(--json) ;;
    "") ;;
    *) echo "Unsupported arguments for /forgeflow-command-args"; exit 2 ;;
  esac
  idx=$((idx + 1))
done
env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/command-args.js" "${SAFE_ARGS[@]}"
```
</process>

<success_criteria>
- [ ] Output states that no command execution occurs.
- [ ] Unsafe shell metacharacters and unsupported flags are rejected.
</success_criteria>
