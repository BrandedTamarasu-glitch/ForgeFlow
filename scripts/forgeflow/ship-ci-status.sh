#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-once}"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh is not installed." >&2
  exit 1
fi

if [ "$MODE" = "--watch" ]; then
  gh pr checks "$BRANCH" --watch
else
  gh pr checks "$BRANCH"
fi
