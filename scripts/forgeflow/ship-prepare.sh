#!/usr/bin/env bash
set -euo pipefail

HELPER_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
"$HELPER_ROOT/scripts/forgeflow/ensure-forgeflow-state.sh" > /tmp/forgeflow-state.env
# shellcheck disable=SC1091
source /tmp/forgeflow-state.env

TITLE="${*:-}"
DATE_ISO="$(date -Iseconds)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
BASE_BRANCH="$(git remote show origin 2>/dev/null | awk '/HEAD branch/ {print $NF}' || true)"
if [ -z "${BASE_BRANCH:-}" ]; then
  BASE_BRANCH="main"
fi

BASE_REF="origin/$BASE_BRANCH"
if ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  BASE_REF="$BASE_BRANCH"
fi

MERGE_BASE="$(git merge-base HEAD "$BASE_REF" 2>/dev/null || true)"
if [ -z "${MERGE_BASE:-}" ]; then
  MERGE_BASE="HEAD~1"
fi

SUMMARY_TITLE="$TITLE"
if [ -z "$SUMMARY_TITLE" ]; then
  SUMMARY_TITLE="$(git log --format=%s "$MERGE_BASE"..HEAD 2>/dev/null | head -n 1 || true)"
fi
if [ -z "$SUMMARY_TITLE" ]; then
  SUMMARY_TITLE="Release Summary for $BRANCH"
fi

FILE_LIST_JSON="$(git diff --name-status "$MERGE_BASE"..HEAD | python3 -c '
import json,sys
items=[]
for line in sys.stdin:
    line=line.rstrip("\n")
    if not line:
        continue
    parts=line.split("\t", 1)
    status=parts[0]
    path=parts[1] if len(parts) > 1 else ""
    items.append({"status": status, "path": path})
print(json.dumps(items))
')"

TEST_LINES="$(rg -n "PASS|FAIL|passed|failed" "$FORGEFLOW_DIR" -g "*.md" 2>/dev/null | head -n 8 || true)"
TESTS_JSON="$(printf '%s\n' "$TEST_LINES" | python3 -c '
import json,sys
lines=[line.strip() for line in sys.stdin if line.strip()]
print(json.dumps(lines))
')"

REVIEW_TAIL="$(tail -n 80 "$FORGEFLOW_DIR/review-history.md" 2>/dev/null || true)"
if printf '%s' "$REVIEW_TAIL" | grep -Eq "Final Verdict: (APPROVE|CONDITIONAL APPROVE)"; then
  if printf '%s' "$REVIEW_TAIL" | grep -Eq "Compass.s Verdict: CONFIRM|Compass Verdict: CONFIRM"; then
    REVIEW_GATE="passed"
    REVIEW_GATE_NOTE="Recent review history contains an APPROVE/CONDITIONAL APPROVE verdict and an Compass CONFIRM."
  else
    REVIEW_GATE="partial"
    REVIEW_GATE_NOTE="Recent review history contains a Arbiter approval signal, but Compass CONFIRM was not found in the scanned tail."
  fi
else
  REVIEW_GATE="unknown"
  REVIEW_GATE_NOTE="No recent APPROVE verdict was found in the scanned review history tail."
fi

SUMMARY_TEXT="Prepared from the current branch diff against $BASE_REF."
IMPACT_TEXT="This branch changes $(git diff --name-only "$MERGE_BASE"..HEAD | wc -l | tr -d ' ') file(s) and is staged for shipping review."
IMPLEMENTATION_NOTES_PATH="$FORGEFLOW_DIR/implementation-notes.md"

python3 - <<'PY' "$SHIP_DIR/ship-summary.json" "$SUMMARY_TITLE" "$SUMMARY_TEXT" "$IMPACT_TEXT" "$BRANCH" "$BASE_BRANCH" "$DATE_ISO" "$FILE_LIST_JSON" "$TESTS_JSON" "$REVIEW_GATE" "$REVIEW_GATE_NOTE" "$IMPLEMENTATION_NOTES_PATH"
import json, pathlib, sys
(
  out_path,
  title,
  summary,
  impact,
  branch,
  base_branch,
  generated_at,
  files_json,
  tests_json,
  review_gate,
  review_gate_note,
  implementation_notes_path,
) = sys.argv[1:]

def implementation_notes(path):
  sections = {
    "decisions": [],
    "spec_gaps": [],
    "tradeoffs": [],
    "deviations": [],
    "follow_ups": [],
    "validation_notes": [],
  }
  headings = {
    "decisions": "decisions",
    "spec gaps": "spec_gaps",
    "tradeoffs": "tradeoffs",
    "deviations": "deviations",
    "follow-ups": "follow_ups",
    "follow ups": "follow_ups",
    "validation notes": "validation_notes",
  }
  notes_file = pathlib.Path(path)
  if not notes_file.exists():
    return sections
  def summarize_note(line):
    text = line[2:].strip()
    parts = [part.strip() for part in text.split("|")]
    if len(parts) >= 4:
      text = " | ".join(parts[3:]).strip()
    text = text.replace(" Why: ", " - ")
    return text
  current = ""
  for raw in notes_file.read_text(encoding="utf8").splitlines():
    line = raw.strip()
    if line.startswith("## "):
      current = headings.get(line[3:].strip().lower(), "")
      continue
    if current and line.startswith("- "):
      sections[current].append(summarize_note(line))
  return sections

payload = {
  "title": title,
  "summary": summary,
  "impact": impact,
  "branch": branch,
  "baseBranch": base_branch,
  "generatedAt": generated_at,
  "files": json.loads(files_json),
  "tests": json.loads(tests_json),
  "reviewGate": review_gate,
  "reviewGateNote": review_gate_note,
  "capabilities": [
    "Branch summary generated from git history and diff metadata.",
    "Presentation artifact prepared for stakeholder or PR use.",
  ],
  "risksMitigated": [
    "Shipping summary tied to current diff rather than hand-written release notes.",
  ],
  "implementation_notes": implementation_notes(implementation_notes_path),
  "notes": [
    f"Base ref: {base_branch}",
    "Run the review workflow before pushing if the gate is not clearly passed.",
  ],
}
path = pathlib.Path(out_path)
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf8")
PY

node "$HELPER_ROOT/scripts/forgeflow/render-ship-presentation.js" \
  "$SHIP_DIR/ship-summary.json" \
  "$SHIP_DIR/ship-presentation.html"

NOTES_CHECK_JSON="$SHIP_DIR/implementation-notes-check.json"
node "$HELPER_ROOT/scripts/forgeflow/check-implementation-notes.js" \
  --project-dir "$FORGEFLOW_DIR" \
  --ship-summary "$SHIP_DIR/ship-summary.json" \
  --json > "$NOTES_CHECK_JSON"
NOTES_CHECK_STATUS="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("status", "unknown"))' "$NOTES_CHECK_JSON")"

PROJECT_LEARNINGS_JSON="$SHIP_DIR/project-learnings-rollup.json"
node "$HELPER_ROOT/scripts/forgeflow/rollup-project-learnings.js" \
  --project-dir "$FORGEFLOW_DIR" \
  --json > "$PROJECT_LEARNINGS_JSON"
PROJECT_LEARNINGS_PATH="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("out", ""))' "$PROJECT_LEARNINGS_JSON")"

BODY_FILE="$SHIP_DIR/pr-body.md"
cat > "$BODY_FILE" <<EOF
## Summary

$SUMMARY_TITLE

$SUMMARY_TEXT

## Review Gate

- Status: $REVIEW_GATE
- Note: $REVIEW_GATE_NOTE

## Implementation Notes Check

- Status: $NOTES_CHECK_STATUS
- Report: $NOTES_CHECK_JSON

## Project Learnings

- Refreshed: $PROJECT_LEARNINGS_PATH
- Report: $PROJECT_LEARNINGS_JSON

## Generated Artifacts

- $SHIP_DIR/ship-summary.json
- $SHIP_DIR/ship-presentation.html
- $NOTES_CHECK_JSON
- $PROJECT_LEARNINGS_JSON
EOF

printf 'SUMMARY_JSON=%s\n' "$SHIP_DIR/ship-summary.json"
printf 'PRESENTATION_HTML=%s\n' "$SHIP_DIR/ship-presentation.html"
printf 'PR_BODY_MD=%s\n' "$BODY_FILE"
printf 'IMPLEMENTATION_NOTES_CHECK_JSON=%s\n' "$NOTES_CHECK_JSON"
printf 'PROJECT_LEARNINGS_JSON=%s\n' "$PROJECT_LEARNINGS_JSON"
