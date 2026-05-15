#!/usr/bin/env bash
set -euo pipefail

TITLE="${1:-}"
BODY_FILE="${2:-}"
BASE_BRANCH="${3:-main}"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh is not installed." >&2
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"

git push -u origin "$BRANCH"

if gh pr view "$BRANCH" >/dev/null 2>&1; then
  gh pr edit "$BRANCH" --title "$TITLE" --body-file "$BODY_FILE"
  echo "Updated existing PR for $BRANCH"
else
  gh pr create --base "$BASE_BRANCH" --head "$BRANCH" --title "$TITLE" --body-file "$BODY_FILE"
  echo "Created new PR for $BRANCH"
fi
