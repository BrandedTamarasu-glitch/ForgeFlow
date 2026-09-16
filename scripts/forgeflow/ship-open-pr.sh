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

# Fail before any remote write if local workflow state would be published.
node - "$TITLE" "$BODY_FILE" "$BASE_BRANCH" <<'JS'
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const [title, bodyFile, base] = process.argv.slice(2);
const git = args => execFileSync('git', args, { encoding: 'utf8' });
try {
  const body = fs.readFileSync(bodyFile, 'utf8');
  if (/\.forgeflow(?:[\\/]|\b)/i.test(`${title}\n${body}`)) {
    throw new Error('Remove local workflow state references from the PR title and body.');
  }
  const refs = [`refs/remotes/origin/${base}`, `refs/heads/${base}`];
  const baseRef = refs.find(ref => {
    try { git(['rev-parse', '--verify', ref]); return true; } catch { return false; }
  });
  if (!baseRef) throw new Error('Cannot inspect outgoing commits: fetch or select an existing base branch.');
  const paths = [
    git(['ls-files', '-z']),
    git(['ls-tree', '-r', '--name-only', '-z', 'HEAD']),
    git(['log', '--format=', '--name-only', '-z', `${baseRef}..HEAD`, '--']),
  ].join('\0').split(/[\0\n]/);
  if (paths.some(file => /(^|\/)\.forgeflow(\/|$)/.test(file))) {
    throw new Error('Local workflow state is tracked or present in outgoing commits. Resolve it before publishing; local evidence has been preserved.');
  }
} catch (error) {
  console.error(`Publication blocked: ${error.message}`);
  process.exit(1);
}
JS

git push -u origin "$BRANCH"

if gh pr view "$BRANCH" >/dev/null 2>&1; then
  gh pr edit "$BRANCH" --title "$TITLE" --body-file "$BODY_FILE"
  echo "Updated existing PR for $BRANCH"
else
  gh pr create --base "$BASE_BRANCH" --head "$BRANCH" --title "$TITLE" --body-file "$BODY_FILE"
  echo "Created new PR for $BRANCH"
fi
