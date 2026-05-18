#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "$REPO_ROOT")"
FORGEFLOW_DIR="$REPO_ROOT/.forgeflow/$PROJECT_NAME"
NOTES_DIR="$FORGEFLOW_DIR/agent-notes"
SHIP_DIR="$FORGEFLOW_DIR/ship"

mkdir -p "$NOTES_DIR" "$SHIP_DIR"

create_file() {
  local path="$1"
  local content="$2"
  if [ ! -f "$path" ]; then
    printf '%s\n' "$content" > "$path"
  fi
}

create_file "$FORGEFLOW_DIR/codebase-map.md" "# Codebase Map

Living architecture notes for $PROJECT_NAME.
"

create_file "$FORGEFLOW_DIR/patterns.md" "# Patterns

Project-specific good patterns and anti-patterns.
"

create_file "$FORGEFLOW_DIR/review-history.md" "# Review History
"

create_file "$FORGEFLOW_DIR/current-discussion.md" "# Current Discussion
"

create_file "$FORGEFLOW_DIR/current-research.md" "# Current Research
"

create_file "$FORGEFLOW_DIR/current-plan.md" "# Current Plan
"

create_file "$FORGEFLOW_DIR/current-brief.md" "# Current Brief
"

create_file "$FORGEFLOW_DIR/implementation-notes.md" "# Implementation Notes

Running notes for decisions, spec gaps, tradeoffs, deviations, follow-ups, and validation details discovered during implementation.

## At a Glance

- Artifact: .forgeflow/$PROJECT_NAME/implementation-notes.md
- Format: append-only Markdown
- Owner: Atlas serializes note candidates from implement agents; Arbiter verifies and may add final integration notes

## Decisions

## Spec Gaps

## Tradeoffs

## Deviations

## Follow-ups

## Validation Notes
"

if [ ! -f "$FORGEFLOW_DIR/learnings.jsonl" ]; then
  : > "$FORGEFLOW_DIR/learnings.jsonl"
fi

printf 'REPO_ROOT=%s\n' "$REPO_ROOT"
printf 'PROJECT_NAME=%s\n' "$PROJECT_NAME"
printf 'FORGEFLOW_DIR=%s\n' "$FORGEFLOW_DIR"
printf 'SHIP_DIR=%s\n' "$SHIP_DIR"
