#!/usr/bin/env bash
set -euo pipefail

HELPER_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TASK_ID=""
TITLE_PARTS=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --task)
      if [ "$#" -lt 2 ] || [[ "$2" == --* ]] || [ -z "$2" ]; then
        echo "Missing task id. Use ship-prepare.sh --task <id> [title]." >&2
        exit 2
      fi
      if [ -n "$TASK_ID" ]; then
        echo "Select one task with --task <id>." >&2
        exit 2
      fi
      TASK_ID="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: ship-prepare.sh [--task <id>] [title]"
      exit 0
      ;;
    --) shift; TITLE_PARTS+=("$@"); break ;;
    --*) echo "Unknown option: $1. Use --task <id> or -- before the title." >&2; exit 2 ;;
    *) TITLE_PARTS+=("$1"); shift ;;
  esac
done
TITLE="${TITLE_PARTS[*]}"
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"
"$HELPER_ROOT/scripts/forgeflow/ensure-forgeflow-state.sh" >/dev/null
PROJECT_NAME="$(basename "$REPO_ROOT")"
FORGEFLOW_DIR="$REPO_ROOT/.forgeflow/$PROJECT_NAME"
SHIP_DIR="$FORGEFLOW_DIR/ship"

DATE_ISO="$(date -Iseconds)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
BASE_BRANCH="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true)"
BASE_BRANCH="${BASE_BRANCH#origin/}"
if [ -z "${BASE_BRANCH:-}" ]; then
  BASE_BRANCH="main"
fi

BASE_REF="origin/$BASE_BRANCH"
if ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  BASE_REF="$BASE_BRANCH"
fi

MERGE_BASE="$(git merge-base HEAD "$BASE_REF" 2>/dev/null || true)"
if [ -z "${MERGE_BASE:-}" ]; then
  MERGE_BASE="$(git rev-parse --verify HEAD^ 2>/dev/null || git rev-parse HEAD)"
  BASE_REF="$MERGE_BASE"
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

SUMMARY_TEXT="Prepared from the current branch diff against $BASE_REF."
IMPACT_TEXT="This branch changes $(git diff --name-only "$MERGE_BASE"..HEAD | wc -l | tr -d ' ') file(s) and is staged for shipping review."
IMPLEMENTATION_NOTES_PATH="$FORGEFLOW_DIR/implementation-notes.md"

node - "$HELPER_ROOT" "$REPO_ROOT" "$SHIP_DIR" "$TASK_ID" "$SUMMARY_TITLE" "$SUMMARY_TEXT" "$IMPACT_TEXT" "$BRANCH" "$BASE_BRANCH" "$DATE_ISO" "$FILE_LIST_JSON" <<'JS'
const fs = require('node:fs');
const path = require('node:path');
const [helperRoot, root, shipDir, taskId, title, summary, impact, branch, baseBranch, generatedAt, filesJson] = process.argv.slice(2);
let task = null;
try {
  if (taskId) {
    const store = require(path.join(helperRoot, 'scripts/forgeflow/task-store.js'));
    task = store.taskView(root, store.readTask(root, taskId));
  }
} catch (error) {
  console.error(`Cannot prepare task ${taskId}: ${error.message}. Select an existing task from task.js list and rerun ship-prepare.sh --task <id>. No new shipping summary was written.`);
  process.exit(1);
}
// Only each criterion's latest evidence can support its current outcome.
// taskView checks the source snapshot and evidence artifact hash; never infer
// freshness from a timestamp, an old approval, or words in project Markdown.
const selected = new Set(task?.criteria.map(item => item.evidence_id).filter(Boolean) || []);
const evidence = (task?.evidence || []).filter(item => selected.has(item.id)).map(item => ({
  id: item.id, kind: item.kind, status: item.status, freshness: item.freshness,
  criteria: task.criteria.filter(criterion => criterion.evidence_id === item.id).map(criterion => criterion.id),
  artifact: item.artifact?.path || null, exitCode: item.exit_code,
}));
const current = evidence.filter(item => item.freshness === 'current');
const describe = item => `${item.id}: ${item.status}${item.exitCode === null ? '' : ` (exit ${item.exitCode})`}; criteria: ${item.criteria.join(', ')}; evidence: ${item.artifact || 'explicit waiver, no artifact'}`;
const validationSummary = task
  ? `Task ${task.id}: ${task.status}. ${task.counts.verified}/${task.counts.total} criteria verified; ${task.counts.failed} failed, ${task.counts.stale} stale, ${task.counts.missing} missing, ${task.counts.waived} waived. ${task.next_action}`
  : 'No task selected. Validation is missing. Use ship-prepare.sh --task <id> to include current task evidence; legacy project notes are not validation.';
const validationDetails = task ? [
  ...task.criteria.map(item => `${item.id}: ${item.status} (${item.description})`),
  ...task.actions.filter(item => ['pending', 'unknown'].includes(item.status)).map(item => `Action ${item.id}: ${item.status}. ${item.description}`),
] : [];
const payload = {
  title, summary, impact, branch, baseBranch, generatedAt, files: JSON.parse(filesJson),
  task: task ? { id: task.id, scope: task.workspace.scope, status: task.status, ready: task.ready, counts: task.counts } : null,
  validationSummary, validationDetails, validationEvidence: evidence,
  tests: current.filter(item => item.kind === 'test').map(describe),
  manualChecks: current.filter(item => item.kind === 'manual').map(describe),
  reviewEvidence: current.filter(item => item.kind === 'review').map(describe),
  reviewGate: 'unknown',
  reviewGateNote: 'Verify explicit reviewer verdicts against the current task and source before publishing. Task readiness and passing checks are not review approval; project review history is not used as a gate.',
  capabilities: [], risksMitigated: [],
  implementation_notes: { decisions: [], spec_gaps: [], tradeoffs: [], deviations: [], follow_ups: [], validation_notes: [] },
  notes: [
    `Base ref: ${baseBranch}`,
    'Historical context only: implementation-notes.md, review-history.md and project-learnings.md. Their content is not imported into current validation or approval. Curate relevant notes with current evidence before publishing.',
  ],
};
fs.writeFileSync(path.join(shipDir, 'ship-summary.json'), JSON.stringify(payload, null, 2) + '\n');
const list = (items, empty) => items.length ? items.map(item => `- ${item}`).join('\n') : empty;
fs.writeFileSync(path.join(shipDir, 'pr-body.md'), [
  '## Summary', title, summary,
  '## Review Gate', payload.reviewGate, payload.reviewGateNote,
  '## Task Validation', validationSummary, list(validationDetails, 'No task criteria available.'),
  '## Tests', list(payload.tests, 'No current automated test evidence.'),
  '## Manual Checks', list(payload.manualChecks, 'No current manual evidence.'),
  '## Review Evidence', list(payload.reviewEvidence, 'No current task review evidence. Explicit verdict verification is still required.'),
  '## Historical Context', payload.notes[1], '',
].join('\n\n'));
JS

node "$HELPER_ROOT/scripts/forgeflow/render-ship-presentation.js" \
  "$SHIP_DIR/ship-summary.json" \
  "$SHIP_DIR/ship-presentation.html"

NOTES_CHECK_JSON="$SHIP_DIR/implementation-notes-check.json"
node "$HELPER_ROOT/scripts/forgeflow/check-implementation-notes.js" \
  --project-dir "$FORGEFLOW_DIR" \
  --ship-summary "$SHIP_DIR/ship-summary.json" \
  --json > "$NOTES_CHECK_JSON"
NOTES_CHECK_STATUS="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("status", "unknown"))' "$NOTES_CHECK_JSON")"

LEAN_READINESS_JSON="$SHIP_DIR/lean-readiness.json"
python3 - <<'PY' "$LEAN_READINESS_JSON" "$FORGEFLOW_DIR/context/lean-decision.json" "$FORGEFLOW_DIR/context/lean-report.json" "$IMPLEMENTATION_NOTES_PATH"
import json, pathlib, sys
out_path, decision_path, report_path, notes_path = sys.argv[1:]
decision = pathlib.Path(decision_path)
report = pathlib.Path(report_path)
notes = pathlib.Path(notes_path)
issues = []
if not decision.exists():
  status = "not-applicable"
  reason = "No lean decision artifact is present."
else:
  status = "pass"
  reason = "Lean decision has matching report and ceiling evidence."
  if not report.exists():
    issues.append({
      "code": "lean-report-missing",
      "message": "Lean decision exists but lean-report.json is missing.",
      "fix": "Run /forgeflow-lean-report --write before relying on lean metrics.",
    })
  notes_text = notes.read_text(encoding="utf8") if notes.exists() else ""
  if not any(phrase in notes_text for phrase in ["Lean path selected", "Known ceiling", "Upgrade trigger"]):
    issues.append({
      "code": "lean-ceiling-evidence-missing",
      "message": "Lean decision exists but implementation notes do not show ceiling or upgrade-trigger evidence.",
      "fix": "Record the lean ceiling with record-implementation-notes.js --lean-decision.",
    })
  if issues:
    status = "warn"
    reason = "Lean decision exists, but lean report or ceiling evidence is missing."
payload = {
  "schema_version": "1",
  "status": status,
  "reason": reason,
  "decision_path": str(decision),
  "report_path": str(report),
  "notes_path": str(notes),
  "issues": issues,
  "boundary": "Lean readiness is advisory. It does not bypass or fail review gate, PR creation, push, CI follow-up, security, accessibility, validation, or user instructions by itself.",
}
path = pathlib.Path(out_path)
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf8")
PY
LEAN_READINESS_STATUS="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("status", "unknown"))' "$LEAN_READINESS_JSON")"

PROJECT_LEARNINGS_JSON="$SHIP_DIR/project-learnings-rollup.json"
node "$HELPER_ROOT/scripts/forgeflow/show-project-learnings.js" \
  --project-dir "$FORGEFLOW_DIR" \
  --json > "$PROJECT_LEARNINGS_JSON"
PROJECT_LEARNINGS_PATH="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("out", ""))' "$PROJECT_LEARNINGS_JSON")"

BODY_FILE="$SHIP_DIR/pr-body.md"
cat >> "$BODY_FILE" <<EOF
## Implementation Notes Check

- Status: $NOTES_CHECK_STATUS
- Report: $NOTES_CHECK_JSON

## Lean Readiness

- Status: $LEAN_READINESS_STATUS
- Report: $LEAN_READINESS_JSON

## Project Learnings

- Refreshed: $PROJECT_LEARNINGS_PATH
- Report: $PROJECT_LEARNINGS_JSON

## Generated Artifacts

- $SHIP_DIR/ship-summary.json
- $SHIP_DIR/ship-presentation.html
- $NOTES_CHECK_JSON
- $LEAN_READINESS_JSON
- $PROJECT_LEARNINGS_JSON
EOF

printf 'SUMMARY_JSON=%s\n' "$SHIP_DIR/ship-summary.json"
printf 'PRESENTATION_HTML=%s\n' "$SHIP_DIR/ship-presentation.html"
printf 'PR_BODY_MD=%s\n' "$BODY_FILE"
printf 'IMPLEMENTATION_NOTES_CHECK_JSON=%s\n' "$NOTES_CHECK_JSON"
printf 'LEAN_READINESS_JSON=%s\n' "$LEAN_READINESS_JSON"
printf 'PROJECT_LEARNINGS_JSON=%s\n' "$PROJECT_LEARNINGS_JSON"
