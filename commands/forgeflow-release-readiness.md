---
name: forgeflow-release-readiness
description: Run advisory local release readiness checks and show blockers without tagging, pushing, publishing, or calling GitHub.
argument-hint: "[--plan-only] [--json] [--compare-last] [--save-current] [--post-publish] [--save-post-publish] [--compare-post-publish-last]"
allowed-tools:
  - Bash
---

Run the local release readiness helper. This command is advisory and release-safe: it never tags, pushes, publishes, or calls GitHub. With `--save-current`, it writes a local readiness snapshot under `.forgeflow/<project>/release-readiness/`. With `--post-publish`, it adds a local post-publish verification block for plugin version, local tag, changelog, release-note draft, source smoke, and update smoke evidence. With `--save-post-publish`, it writes `.forgeflow/<project>/release-readiness/post-publish-last.json`; with `--compare-post-publish-last`, it compares against that snapshot.

```bash
HELPER_DIR="scripts/forgeflow"
if [ ! -f "${HELPER_DIR}/render-release-readiness.js" ] && [ -f "$HOME/.claude/forgeflow/scripts/forgeflow/render-release-readiness.js" ]; then
  HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"
fi

if [ ! -f "${HELPER_DIR}/render-release-readiness.js" ]; then
  echo "Release readiness helper is not installed. Run /update-forgeflow --repair, then retry /forgeflow-release-readiness."
  exit 1
fi

ARGS=()
PLAN_ONLY_FLAG="--plan-only"
JSON_FLAG="--json"
COMPARE_LAST_FLAG="--compare-last"
SAVE_CURRENT_FLAG="--save-current"
POST_PUBLISH_FLAG="--post-publish"
SAVE_POST_PUBLISH_FLAG="--save-post-publish"
COMPARE_POST_PUBLISH_LAST_FLAG="--compare-post-publish-last"

if printf '%s\n' "$ARGUMENTS" | grep -Eq '(^|[[:space:]])--plan-only([[:space:]]|$)'; then
  ARGS+=("${PLAN_ONLY_FLAG}")
fi
if printf '%s\n' "$ARGUMENTS" | grep -Eq '(^|[[:space:]])--json([[:space:]]|$)'; then
  ARGS+=("${JSON_FLAG}")
fi
if printf '%s\n' "$ARGUMENTS" | grep -Eq '(^|[[:space:]])--compare-last([[:space:]]|$)'; then
  ARGS+=("${COMPARE_LAST_FLAG}")
fi
if printf '%s\n' "$ARGUMENTS" | grep -Eq '(^|[[:space:]])--save-current([[:space:]]|$)'; then
  ARGS+=("${SAVE_CURRENT_FLAG}")
fi
if printf '%s\n' "$ARGUMENTS" | grep -Eq '(^|[[:space:]])--post-publish([[:space:]]|$)'; then
  ARGS+=("${POST_PUBLISH_FLAG}")
fi
if printf '%s\n' "$ARGUMENTS" | grep -Eq '(^|[[:space:]])--save-post-publish([[:space:]]|$)'; then
  ARGS+=("${SAVE_POST_PUBLISH_FLAG}")
fi
if printf '%s\n' "$ARGUMENTS" | grep -Eq '(^|[[:space:]])--compare-post-publish-last([[:space:]]|$)'; then
  ARGS+=("${COMPARE_POST_PUBLISH_LAST_FLAG}")
fi

env -u NODE_OPTIONS -u NODE_PATH node "${HELPER_DIR}/render-release-readiness.js" "${ARGS[@]}"
```
