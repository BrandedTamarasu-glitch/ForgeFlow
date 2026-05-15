#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
"$REPO_ROOT/scripts/forgeflow/ensure-forgeflow-state.sh" > /tmp/forgeflow-state.env
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

python3 - <<'PY' "$SHIP_DIR/ship-summary.json" "$SUMMARY_TITLE" "$SUMMARY_TEXT" "$IMPACT_TEXT" "$BRANCH" "$BASE_BRANCH" "$DATE_ISO" "$FILE_LIST_JSON" "$TESTS_JSON" "$REVIEW_GATE" "$REVIEW_GATE_NOTE"
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
) = sys.argv[1:]
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
  "notes": [
    f"Base ref: {base_branch}",
    "Run the review workflow before pushing if the gate is not clearly passed.",
  ],
}
path = pathlib.Path(out_path)
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf8")
PY

node "$REPO_ROOT/scripts/forgeflow/render-ship-presentation.js" \
  "$SHIP_DIR/ship-summary.json" \
  "$SHIP_DIR/ship-presentation.html"

BODY_FILE="$SHIP_DIR/pr-body.md"
cat > "$BODY_FILE" <<EOF
## Summary

$SUMMARY_TITLE

$SUMMARY_TEXT

## Review Gate

- Status: $REVIEW_GATE
- Note: $REVIEW_GATE_NOTE

## Generated Artifacts

- $SHIP_DIR/ship-summary.json
- $SHIP_DIR/ship-presentation.html
EOF

printf 'SUMMARY_JSON=%s\n' "$SHIP_DIR/ship-summary.json"
printf 'PRESENTATION_HTML=%s\n' "$SHIP_DIR/ship-presentation.html"
printf 'PR_BODY_MD=%s\n' "$BODY_FILE"
