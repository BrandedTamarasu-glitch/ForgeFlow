#!/usr/bin/env bash
# Forgeflow — PR Review Wrapper (V5.0 Phase 2 Theme A)
#
# Invoked by .github/workflows/forgeflow.yml on pull_request events.
# Runs /review --ci in headless mode, parses the verdict JSON block, posts
# a PR comment, and optionally triggers /review-auto in review-and-fix mode.
#
# Required environment:
#   GITHUB_TOKEN           — for gh CLI (auto-provided in Actions)
#   GITHUB_REPOSITORY      — "owner/repo" (auto-provided in Actions)
#   GITHUB_PR_NUMBER       — PR number (passed by workflow from event)
#   ANTHROPIC_API_KEY      OR CLAUDE_CODE_OAUTH_TOKEN
#
# Optional:
#   CLAUDE_MODEL           — defaults to claude-opus-4-7
#   FORGEFLOW_BUDGET_FILE      — path to budget config (default .github/forgeflow-budget.yml)
#   FORGEFLOW_MODE_OVERRIDE    — force skip | thin | full | deep (for debugging)
#   GITHUB_STEP_SUMMARY    — markdown summary file (auto-provided in Actions)
#
# Exit codes:
#   0 — APPROVE / CONDITIONAL_APPROVE / SKIPPED
#   1 — REVISE / BLOCK
#   2 — ABORTED (pre-flight, budget, auth, or wrapper error)

set -euo pipefail

# ---------- config ----------
BUDGET_FILE="${FORGEFLOW_BUDGET_FILE:-.github/forgeflow-budget.yml}"
CLAUDE_MODEL="${CLAUDE_MODEL:-claude-opus-4-7}"
VERDICT_SENTINEL_OPEN='<forgeflow-verdict-json>'
VERDICT_SENTINEL_CLOSE='</forgeflow-verdict-json>'
SCHEMA_VERSION='1'

# ---------- helpers ----------
log()  { printf '[forgeflow-pr-review] %s\n' "$*" >&2; }
fail() { log "FATAL: $*"; exit 2; }

require() {
  command -v "$1" >/dev/null 2>&1 || fail "missing dependency: $1"
}

# Simple YAML scalar reader. Supports `key: value` at top level only.
# For nested config we fall back to defaults rather than bundling a YAML parser.
yaml_get() {
  local file="$1" key="$2" default="$3"
  if [ -r "$file" ]; then
    local v
    v=$(awk -v k="^${key}:" '$0 ~ k { sub(/^[^:]+:[[:space:]]*/, ""); sub(/[[:space:]]*#.*$/, ""); gsub(/^"|"$/, ""); print; exit }' "$file")
    if [ -n "$v" ]; then
      printf '%s' "$v"
      return
    fi
  fi
  printf '%s' "$default"
}

emit_summary() {
  # Appends markdown to GITHUB_STEP_SUMMARY if defined (GitHub Actions).
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    cat >> "$GITHUB_STEP_SUMMARY"
  fi
}

post_comment() {
  local body_file="$1"
  # Capture the URL gh prints on success so the follow-up auto-fix comment
  # can link back to the original Forgeflow comment. Writes to LAST_COMMENT_URL
  # (global) when available. Fork PRs or token scope issues leave it empty.
  local out
  if out=$(gh pr comment "$GITHUB_PR_NUMBER" --repo "$GITHUB_REPOSITORY" --body-file "$body_file" 2>&1); then
    # gh prints the URL on success (e.g. "https://github.com/owner/repo/issues/N#issuecomment-ABC")
    LAST_COMMENT_URL=$(printf '%s\n' "$out" | grep -Eo 'https://github\.com/[^[:space:]]+#issuecomment-[0-9]+' | head -n 1)
    return 0
  else
    log "WARN: gh pr comment failed — token may be missing scopes, PR closed, or fork PR with downgraded permissions (see ci-wrapper.md troubleshooting). Verdict JSON still in workflow logs and artifact."
    LAST_COMMENT_URL=""
    return 1
  fi
}

# ---------- entry gates ----------
require gh
require jq
require claude

[ -n "${GITHUB_PR_NUMBER:-}" ] || fail "GITHUB_PR_NUMBER not set"
[ -n "${GITHUB_REPOSITORY:-}" ] || fail "GITHUB_REPOSITORY not set"

if [ -z "${ANTHROPIC_API_KEY:-}" ] && [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  fail "neither ANTHROPIC_API_KEY nor CLAUDE_CODE_OAUTH_TOKEN is set"
fi

# ---------- budget config ----------
MAX_COST_USD=$(yaml_get "$BUDGET_FILE" "max_cost_per_pr_usd" "1.00")
FORGEFLOW_MODE=$(yaml_get "$BUDGET_FILE" "mode" "review-only")            # review-only | review-and-fix
ROUTING_CAP=$(yaml_get "$BUDGET_FILE" "routing_cap" "thin")           # skip | thin | full | deep
FAIL_ON_REVISE=$(yaml_get "$BUDGET_FILE" "fail_action_on_revise" "true")
COMMENT_ON_SKIP=$(yaml_get "$BUDGET_FILE" "comment_on_skip" "false")

# ---------- validate config ----------
# Bad values are caught early so the Forgeflow team doesn't silently misbehave
# (e.g., max_cost=invalid parses as 0 and fires budget-exceeded on every PR).
validate_enum() {
  local key="$1" value="$2" allowed="$3"
  case " $allowed " in
    *" $value "*) return 0 ;;
    *) fail "${BUDGET_FILE}: ${key}=${value} not in {${allowed// /, }}" ;;
  esac
}
validate_bool() {
  local key="$1" value="$2"
  case "$value" in
    true|false) return 0 ;;
    *) fail "${BUDGET_FILE}: ${key}=${value} must be exactly 'true' or 'false'" ;;
  esac
}
validate_number() {
  local key="$1" value="$2"
  # awk coerces non-numeric strings to 0. "1.00" → 1.00 (>0 passes), "invalid" → 0 (>0 fails).
  if ! awk -v v="$value" 'BEGIN { exit !(v+0 > 0) }'; then
    fail "${BUDGET_FILE}: ${key}=${value} must be a positive number"
  fi
}

validate_number "max_cost_per_pr_usd" "$MAX_COST_USD"
validate_enum   "mode" "$FORGEFLOW_MODE" "review-only review-and-fix"
validate_enum   "routing_cap" "$ROUTING_CAP" "skip thin full deep"
validate_bool   "fail_action_on_revise" "$FAIL_ON_REVISE"
validate_bool   "comment_on_skip" "$COMMENT_ON_SKIP"

log "budget: max_cost=\$${MAX_COST_USD} mode=${FORGEFLOW_MODE} cap=${ROUTING_CAP} fail_on_revise=${FAIL_ON_REVISE}"

# ---------- rough cost pre-estimate ----------
# Approximation: token count × per-mode multiplier × model rate.
# Goal: detect obvious budget overruns BEFORE spawning the Forgeflow team.
# Real cost estimate comes back in the verdict JSON after the run.
CHANGED_FILES=$(git diff --name-only "origin/${GITHUB_BASE_REF:-main}...HEAD" 2>/dev/null | wc -l)
LINES_CHANGED=$(git diff --numstat "origin/${GITHUB_BASE_REF:-main}...HEAD" 2>/dev/null | awk '{s+=$1+$2} END {print s+0}')

# Per-mode cost rough ceilings (USD). Rough heuristics, not calibrated.
# Budget gate is a SAFETY NET (catch runaway cost), not a precise estimate.
#   thin-mode:   ~2 agents, short diffs           → ~$0.15
#   full-mode:   4 agents + Arbiter + Compass         → ~$0.60
#   deep-mode:   full + Warden audit pass          → ~$0.90
#   skip-mode:   classifier only                  → ~$0.02
# Chunking multiplier applies when file count exceeds Step 3.6 threshold (30).

case "$ROUTING_CAP" in
  skip) PRE_ESTIMATE="0.02" ;;
  thin) PRE_ESTIMATE="0.15" ;;
  full) PRE_ESTIMATE="0.60" ;;
  deep) PRE_ESTIMATE="0.90" ;;
  *)    PRE_ESTIMATE="0.60" ;;
esac

if [ "$CHANGED_FILES" -gt 30 ]; then
  # Rough upper bound: up to 8 chunks * per-chunk cost; in practice ~4x.
  PRE_ESTIMATE=$(awk -v e="$PRE_ESTIMATE" 'BEGIN { printf "%.2f", e*4 }')
fi

# Compare as floats via awk
if awk -v e="$PRE_ESTIMATE" -v m="$MAX_COST_USD" 'BEGIN { exit !(e > m) }'; then
  log "pre-estimate \$${PRE_ESTIMATE} exceeds budget \$${MAX_COST_USD} — emitting ABORTED comment and exiting"

  body=$(mktemp)
  cat > "$body" <<EOF
### 🟡 Forgeflow — Skipped (budget)

**Pre-estimated cost:** \$${PRE_ESTIMATE}
**Budget:** \$${MAX_COST_USD}
**Files changed:** ${CHANGED_FILES}
**Lines changed:** ${LINES_CHANGED}

The Forgeflow team did not run on this PR because the estimated cost exceeded the configured budget in \`${BUDGET_FILE}\`.

**Options:**
- Raise \`max_cost_per_pr_usd\` in \`${BUDGET_FILE}\` if you want larger diffs covered
- Run \`/review\` locally to review this PR interactively
- Split this PR into smaller changes if the diff crossed the 30-file chunking threshold

<sub>\`schema_version: 1\` · wrapper: forgeflow-pr-review.sh · mode: ${FORGEFLOW_MODE} · routing_cap: ${ROUTING_CAP}</sub>
EOF

  post_comment "$body"
  rm -f "$body"
  exit 2
fi

# ---------- build /review invocation ----------
# --mode handling:
#   thin cap (default) → pass NO --mode flag so Step 0.5d.1 CI cap runs
#     (classifier routes per diff; full-mode downgrades to thin; deep-mode
#     is preserved for auth / migration / crypto paths).
#   any other cap       → explicit --mode <cap> force. User is opting into
#     a specific mode for every PR; deep-mode escalation is disabled.
#   FORGEFLOW_MODE_OVERRIDE  → highest-priority debug override.
if [ -n "${FORGEFLOW_MODE_OVERRIDE:-}" ]; then
  validate_enum "FORGEFLOW_MODE_OVERRIDE (env)" "$FORGEFLOW_MODE_OVERRIDE" "skip thin full deep"
  MODE_ARG="--mode ${FORGEFLOW_MODE_OVERRIDE}"
  log "mode: user override → ${FORGEFLOW_MODE_OVERRIDE}"
elif [ "$ROUTING_CAP" != "thin" ]; then
  MODE_ARG="--mode ${ROUTING_CAP}"
  log "mode: budget cap → ${ROUTING_CAP} (forces mode, disables deep-mode escalation)"
else
  MODE_ARG=""
  log "mode: default thin cap → classifier decides; full downgrades to thin; deep preserved"
fi

log "invoking /review --ci --pr ${GITHUB_PR_NUMBER} ${MODE_ARG}"

RAW_OUT=$(mktemp)
STDERR_OUT=$(mktemp)

# Capture stdout and stderr separately to avoid the process-substitution race
# where `2> >(tee ...)` may still be flushing when the script reads the file.
# Disable set -e temporarily around claude so a non-zero exit doesn't abort.
set +e
CLAUDE_CODE_HEADLESS=1 claude -p "/review --ci --pr ${GITHUB_PR_NUMBER} ${MODE_ARG}" \
  --model "$CLAUDE_MODEL" \
  > "$RAW_OUT" 2> "$STDERR_OUT"
CLAUDE_EXIT=$?
set -e

# Mirror stderr to the Action log now that claude has fully finished.
cat "$STDERR_OUT" >&2 2>/dev/null || true
log "claude exit code: ${CLAUDE_EXIT}"

# ---------- extract verdict JSON ----------
# Python regex with DOTALL is robust to sentinels on the same line as the
# JSON payload. Awk line-based extraction would miss that shape.
VERDICT_JSON=$(mktemp)
python3 - "$RAW_OUT" > "$VERDICT_JSON" <<'PYEOF'
import re, sys
with open(sys.argv[1], 'r') as f:
    content = f.read()
match = re.search(r'<forgeflow-verdict-json>(.*?)</forgeflow-verdict-json>', content, re.DOTALL)
if match:
    sys.stdout.write(match.group(1).strip())
PYEOF

if [ ! -s "$VERDICT_JSON" ] || ! jq -e 'type == "object" and has("schema_version")' "$VERDICT_JSON" >/dev/null 2>&1; then
  log "no verdict block found (or block is not a schema-shaped object) in claude output — emitting failure comment"

  # Redact common secret patterns before embedding stderr in a PUBLIC PR
  # comment. Catches Anthropic API keys, bearer tokens, OAuth tokens, and
  # generic long hex strings that could be session identifiers.
  REDACTED_STDERR=$(tail -40 "${STDERR_OUT}" 2>/dev/null \
    | sed -E \
        -e 's#sk-ant-[A-Za-z0-9_-]{20,}#[REDACTED-anthropic-key]#g' \
        -e 's#Bearer [A-Za-z0-9._~+/=-]+#Bearer [REDACTED]#g' \
        -e 's#ghp_[A-Za-z0-9]{20,}#[REDACTED-github-pat]#g' \
        -e 's#gho_[A-Za-z0-9]{20,}#[REDACTED-github-oauth]#g' \
        -e 's#ghs_[A-Za-z0-9]{20,}#[REDACTED-github-server]#g' \
      || echo "(stderr not captured)")

  body=$(mktemp)
  cat > "$body" <<EOF
<!-- forgeflow:verdict schema_version=1 phase=wrapper-failure -->
### 🔴 Forgeflow — Wrapper failure

The Forgeflow team ran but did not emit a parseable verdict block. This is a bug in the Forgeflow team itself or the wrapper — not a code issue.

**Claude exit code:** ${CLAUDE_EXIT}

**Last 40 lines of stderr (secrets redacted):**
\`\`\`
${REDACTED_STDERR}
\`\`\`

Please file an issue in BrandedTamarasu-glitch/ForgeFlow with the workflow run URL.

<sub>\`schema_version: 1\` · wrapper: forgeflow-pr-review.sh</sub>
EOF

  post_comment "$body"
  rm -f "$body" "$RAW_OUT" "$VERDICT_JSON" "${STDERR_OUT}"
  exit 2
fi

# ---------- validate schema ----------
# Already checked above (empty or non-object), but re-check here since we're
# about to parse fields. If the block is valid JSON but missing required
# keys, jq returns null strings we'd happily use — tighten here.

JSON_SCHEMA_VERSION=$(jq -r '.schema_version // ""' "$VERDICT_JSON")
if [ "$JSON_SCHEMA_VERSION" != "$SCHEMA_VERSION" ]; then
  MIGRATION_DOC='docs/forgeflow-json-schema.md#schema-evolution'
  log "schema version mismatch: got '${JSON_SCHEMA_VERSION}' (actual), wrapper expects '${SCHEMA_VERSION}' (expected). See ${MIGRATION_DOC} for the migration contract — there is no auto-migration, no silent fallback."

  # Write a machine-readable failure envelope to the artifact path so CI
  # can surface the version skew in the PR comment without a second parse.
  FAILURE_ARTIFACT=$(mktemp /tmp/forgeflow-verdict-final-XXXXXX.json)
  jq -n \
    --arg expected "$SCHEMA_VERSION" \
    --arg actual   "$JSON_SCHEMA_VERSION" \
    --arg doc      "$MIGRATION_DOC" \
    '{
      schema_version: "0",
      verdict: "ABORTED",
      summary: "Wrapper rejected verdict JSON due to schema_version mismatch.",
      reason: "schema-version-mismatch",
      schema_mismatch: {
        expected_version: $expected,
        actual_version:   $actual,
        migration_doc:    $doc
      }
    }' > "$FAILURE_ARTIFACT"

  # Also post a PR comment so the PR author sees the failure without
  # digging through Actions logs. Comment uses schema_version="0" marker
  # to distinguish from real Forgeflow verdicts.
  SKEW_BODY=$(mktemp)
  cat > "$SKEW_BODY" <<SKEWEOF
<!-- forgeflow:verdict schema_version=0 phase=schema-skew -->
### 🔴 Forgeflow — Schema version mismatch

The Forgeflow team ran but emitted a verdict JSON at \`schema_version: ${JSON_SCHEMA_VERSION}\` while the wrapper pins to \`${SCHEMA_VERSION}\`. The wrapper will not forward-compat-guess; a human has to migrate.

**Expected:** \`${SCHEMA_VERSION}\`
**Actual:** \`${JSON_SCHEMA_VERSION}\`
**Migration contract:** [\`${MIGRATION_DOC}\`](https://github.com/BrandedTamarasu-glitch/ForgeFlow/blob/main/${MIGRATION_DOC})

**Next step:** update this repo's \`scripts/forgeflow-pr-review.sh\` to support \`schema_version: ${JSON_SCHEMA_VERSION}\` before the Forgeflow team can run again.
SKEWEOF
  post_comment "$SKEW_BODY" || true
  rm -f "$SKEW_BODY"

  exit 2
fi

VERDICT=$(jq -r '.verdict' "$VERDICT_JSON")
SUMMARY=$(jq -r '.summary' "$VERDICT_JSON")
ROUTING_MODE=$(jq -r '.routing_mode' "$VERDICT_JSON")
COST_USD=$(jq -r '.metadata.cost_estimate_usd // 0' "$VERDICT_JSON")
DURATION=$(jq -r '.metadata.duration_seconds // 0' "$VERDICT_JSON")

log "verdict=${VERDICT} routing=${ROUTING_MODE} cost=\$${COST_USD} duration=${DURATION}s"

# ---------- handle SKIPPED separately ----------
if [ "$VERDICT" = "SKIPPED" ]; then
  if [ "$COMMENT_ON_SKIP" = "true" ]; then
    REASON=$(jq -r '.reason // "unknown"' "$VERDICT_JSON")
    body=$(mktemp)
    cat > "$body" <<EOF
### ⚪ Forgeflow — Skipped

${SUMMARY}

**Reason:** \`${REASON}\`
**Routing:** \`${ROUTING_MODE}\`

<sub>\`schema_version: 1\` · wrapper: forgeflow-pr-review.sh</sub>
EOF
    post_comment "$body"
    rm -f "$body"
  fi
  rm -f "$RAW_OUT" "$VERDICT_JSON" "${STDERR_OUT}"
  exit 0
fi

# ---------- handle ABORTED ----------
if [ "$VERDICT" = "ABORTED" ]; then
  REASON=$(jq -r '.reason // "unknown"' "$VERDICT_JSON")
  body=$(mktemp)
  cat > "$body" <<EOF
### 🔴 Forgeflow — Aborted

${SUMMARY}

**Reason:** \`${REASON}\`

Common causes:
- Pre-flight gate failed (typecheck or lint errors on the PR branch)
- Budget exceeded partway through the run
- Auth token missing or invalid

Fix the underlying issue and push a new commit to retrigger the Forgeflow team.

<sub>\`schema_version: 1\` · wrapper: forgeflow-pr-review.sh</sub>
EOF
  post_comment "$body"
  rm -f "$body" "$RAW_OUT" "$VERDICT_JSON" "${STDERR_OUT}"
  exit 2
fi

# ---------- render findings comment ----------
render_findings_section() {
  local tier="$1" label="$2" icon="$3"
  local count
  count=$(jq -r ".findings.${tier} | length" "$VERDICT_JSON")
  if [ "$count" = "0" ]; then
    return
  fi
  echo ""
  echo "#### ${icon} ${label} (${count})"
  echo ""
  # Escape markdown-breaking tokens in user-controlled strings:
  #   - strip </details> / <details that could escape our collapse wrappers
  #   - collapse newlines in title (keep newlines in detail but indent them)
  #   - truncate detail at 600 chars to keep comment under GitHub's 65536
  #     char body cap when many findings are present
  # Also emit only `file` (no `:0`) when `.line` is null.
  jq -r --arg tier "$tier" '
    .findings[$tier][] |
    ( .title    | gsub("[\r\n]"; " ") | gsub("</?details[^>]*>"; "[details-tag]") ) as $t |
    ( .raised_by // "arbiter" )                                                         as $r |
    ( .class     // "unclassified" )                                                  as $c |
    ( if .file then
        (if .line then "`\(.file):\(.line)`" else "`\(.file)`" end)
      else "cross-cutting" end
    ) as $where |
    ( .detail
      | gsub("</?details[^>]*>"; "[details-tag]")
      | if length > 600 then .[0:600] + "… (truncated; full text in workflow artifact `forgeflow-verdict-<pr>-<attempt>.json`)" else . end
      | gsub("\n"; "\n  ")
    ) as $d |
    "- **[\(.id)] \($t)** — *\($r)* · \($where) · `\($c)`  \n  \($d)"
  ' "$VERDICT_JSON"
}

BODY_FILE=$(mktemp)
case "$VERDICT" in
  APPROVE)             ICON="🟢" ;;
  CONDITIONAL_APPROVE) ICON="🟡" ;;
  REVISE)              ICON="🟠" ;;
  BLOCK)               ICON="🔴" ;;
  *)                   ICON="⚪" ;;
esac

{
  # HTML comment marker — lets other tooling distinguish Forgeflow comments
  # from other bot comments on the same PR.
  echo "<!-- forgeflow:verdict schema_version=1 -->"
  echo "### ${ICON} Forgeflow — ${VERDICT//_/ }"
  echo ""
  echo "${SUMMARY}"
  echo ""

  # Compass E2E status — surface when tests were skipped in CI.
  EMILY_TESTS_RUN=$(jq -r '.compass.tests_run // empty' "$VERDICT_JSON")
  EMILY_SKIP_REASON=$(jq -r '.compass.ci_skipped_reason // empty' "$VERDICT_JSON")
  if [ "$EMILY_TESTS_RUN" = "false" ] && [ -n "$EMILY_SKIP_REASON" ]; then
    # Strip markdown-breaking chars from the reason string before embedding
    # in a quoted blockquote (future reasons may contain backticks, pipes, etc.).
    EMILY_SKIP_SAFE=$(printf '%s' "$EMILY_SKIP_REASON" | tr -d '`|<>\r\n')
    echo "> ⚠️ **E2E validation skipped** (${EMILY_SKIP_SAFE}). Compass performed static review only."
    echo ""
  fi

  echo "| Routing | Cost (est) | Duration | Files |"
  echo "|---|---|---|---|"
  echo "| \`${ROUTING_MODE}\` | \$${COST_USD} | ${DURATION}s | $(jq -r '.files_reviewed | length' "$VERDICT_JSON") |"

  render_findings_section "blockers" "Blockers" "🚫"
  render_findings_section "must_fix" "Must fix" "⚠️"
  render_findings_section "recommended" "Recommended" "💡"

  # Nits and boyscout hidden in collapsed section
  NITS_COUNT=$(jq -r '.findings.nits | length' "$VERDICT_JSON")
  BOYSCOUT_COUNT=$(jq -r '.findings.boyscout | length' "$VERDICT_JSON")
  if [ "$NITS_COUNT" != "0" ] || [ "$BOYSCOUT_COUNT" != "0" ]; then
    echo ""
    echo "<details>"
    echo "<summary>Nits and boyscout fixes ($(( NITS_COUNT + BOYSCOUT_COUNT )))</summary>"
    render_findings_section "nits" "Nits" ""
    render_findings_section "boyscout" "Boyscout" ""
    echo ""
    echo "</details>"
  fi

  # Overturned findings (telemetry visibility)
  OVERTURN_COUNT=$(jq -r '.overturned_findings | length' "$VERDICT_JSON")
  if [ "$OVERTURN_COUNT" != "0" ]; then
    echo ""
    echo "<details>"
    echo "<summary>Arbiter overturned ${OVERTURN_COUNT} finding(s) as false positives</summary>"
    echo ""
    jq -r '.overturned_findings[] | "- **\(.reviewer)** flagged `\(.class)`: \(.finding)"' "$VERDICT_JSON"
    echo ""
    echo "</details>"
  fi

  echo ""
  echo "<sub>\`schema_version: 1\` · mode: ${FORGEFLOW_MODE} · routing_cap: ${ROUTING_CAP}</sub>"
} > "$BODY_FILE"

post_comment "$BODY_FILE"
# Capture the primary comment URL for the follow-up auto-fix comment to link.
PRIMARY_COMMENT_URL="${LAST_COMMENT_URL:-}"

# Also append to workflow step summary for easy inspection
cat "$BODY_FILE" | emit_summary

# ---------- review-and-fix branch ----------
if [ "$FORGEFLOW_MODE" = "review-and-fix" ] && { [ "$VERDICT" = "REVISE" ] || [ "$VERDICT" = "CONDITIONAL_APPROVE" ]; }; then
  # The wrapper gate is NUMERIC, not classification-based. We count
  # findings eligible for auto-fix (nits + must_fix excluding hard-unsafe
  # classes) and invoke /review-auto if at least one exists. /review-auto
  # itself performs the real tier + source-reviewer classification per its
  # own rules in commands/review-auto.md.
  #
  # HARD-UNSAFE classes: findings with these tags always surface for
  # manual review, never counted toward the auto-fix gate. Aligned with
  # the canonical tag vocabulary documented in agents/arbiter-review.md.
  UNSAFE_CLASSES_JQ='["sql-injection", "auth", "secret", "token", "jwt", "permission", "rbac", "crypto", "password", "csrf", "xss", "ssrf"]'

  SAFE_COUNT=$(jq -r --argjson unsafe "$UNSAFE_CLASSES_JQ" '
    (.findings.nits | length) +
    (.findings.must_fix
      | map(select(.class as $c | ($c == null) or ($unsafe | index($c) | not)))
      | length
    )
  ' "$VERDICT_JSON")

  if [ "$SAFE_COUNT" = "0" ]; then
    log "review-and-fix mode set but no non-unsafe findings detected — skipping /review-auto"
  else
    log "review-and-fix mode: invoking /review-auto with ${SAFE_COUNT} safe finding(s)"
    # Pass the verdict via a file path, not inline — avoids shell arg length limits.
    # mktemp avoids predictable paths that could be pre-created as symlinks.
    VERDICT_ARG_PATH=$(mktemp /tmp/forgeflow-verdict-in-XXXXXX.json)
    cp "$VERDICT_JSON" "$VERDICT_ARG_PATH"

    # Capture /review-auto's stdout + stderr so the post-fix verdict JSON
    # can be extracted and a follow-up PR comment posted (review-auto emits
    # its own <forgeflow-verdict-json> block per Step 7.5). Apply the same
    # token-pattern redaction as the main path — defense-in-depth so any
    # future expansion of the follow-up body cannot leak secrets even if
    # claude dumps debug to stderr mid-run.
    AUTO_RAW_UNREDACTED=$(mktemp)
    AUTO_RAW=$(mktemp)
    CLAUDE_CODE_HEADLESS=1 claude -p "/review-auto --ci --pr ${GITHUB_PR_NUMBER} --from-verdict-json ${VERDICT_ARG_PATH}" \
      --model "$CLAUDE_MODEL" \
      > "$AUTO_RAW_UNREDACTED" 2>&1 \
      || log "review-auto exited non-zero — manual follow-up needed"

    sed -E \
      -e 's#sk-ant-[A-Za-z0-9_-]{20,}#[REDACTED-anthropic-key]#g' \
      -e 's#Bearer [A-Za-z0-9._~+/=-]+#Bearer [REDACTED]#g' \
      -e 's#ghp_[A-Za-z0-9]{20,}#[REDACTED-github-pat]#g' \
      -e 's#gho_[A-Za-z0-9]{20,}#[REDACTED-github-oauth]#g' \
      -e 's#ghs_[A-Za-z0-9]{20,}#[REDACTED-github-server]#g' \
      "$AUTO_RAW_UNREDACTED" > "$AUTO_RAW"
    rm -f "$AUTO_RAW_UNREDACTED"

    AUTO_VERDICT_JSON=$(mktemp)
    python3 - "$AUTO_RAW" > "$AUTO_VERDICT_JSON" <<'PYEOF'
import re, sys
with open(sys.argv[1], 'r') as f:
    content = f.read()
match = re.search(r'<forgeflow-verdict-json>(.*?)</forgeflow-verdict-json>', content, re.DOTALL)
if match:
    sys.stdout.write(match.group(1).strip())
PYEOF

    if [ -s "$AUTO_VERDICT_JSON" ] && jq -e 'type == "object"' "$AUTO_VERDICT_JSON" >/dev/null 2>&1; then
      AUTO_STATUS=$(jq -r '.auto_fix_status // "unknown"' "$AUTO_VERDICT_JSON")
      AUTO_ROUNDS=$(jq -r '.auto_fix_rounds // 0' "$AUTO_VERDICT_JSON")
      AUTO_APPLIED=$(jq -r '.auto_fix_items_applied // 0' "$AUTO_VERDICT_JSON")
      AUTO_VERDICT=$(jq -r '.verdict // "unknown"' "$AUTO_VERDICT_JSON")
      # Link back to the primary Forgeflow comment if we captured its URL.
      if [ -n "${PRIMARY_COMMENT_URL:-}" ]; then
        PRIOR_LINK="[prior Forgeflow comment](${PRIMARY_COMMENT_URL})"
      else
        # URL capture failed (fork PR with read-only token, gh CLI output
        # format change, etc.). Point the reader at the PR timeline so the
        # breadcrumb is actionable, not dangling.
        PRIOR_LINK="prior Forgeflow comment (check the PR timeline above)"
      fi
      FOLLOWUP=$(mktemp)
      {
        echo "<!-- forgeflow:verdict schema_version=1 phase=auto-fix -->"
        echo "### 🔁 Forgeflow — Auto-fix round(s): ${AUTO_STATUS}"
        echo ""
        echo "| Rounds | Items applied | Post-fix verdict |"
        echo "|---|---|---|"
        echo "| ${AUTO_ROUNDS} | ${AUTO_APPLIED} | ${AUTO_VERDICT//_/ } |"
        echo ""
        echo "<sub>See ${PRIOR_LINK} for the original findings. \`auto_fix_status: ${AUTO_STATUS}\`</sub>"
      } > "$FOLLOWUP"
      post_comment "$FOLLOWUP" || true
      rm -f "$FOLLOWUP"
    else
      log "no post-fix verdict JSON from /review-auto — original comment stands"
    fi

    rm -f "$VERDICT_ARG_PATH" "$AUTO_RAW" "$AUTO_VERDICT_JSON"
  fi
fi

# ---------- persist verdict for artifact upload ----------
# Copy the final verdict JSON to a mktemp path so the workflow's
# actions/upload-artifact step can capture it before the runner is
# torn down. mktemp avoids predictable paths exploitable via pre-created
# symlinks on self-hosted runners. The workflow artifact glob picks up
# /tmp/forgeflow-verdict-final-*.json.
ARTIFACT_PATH=$(mktemp /tmp/forgeflow-verdict-final-XXXXXX.json)
cp "$VERDICT_JSON" "$ARTIFACT_PATH" 2>/dev/null || true

# ---------- cleanup + exit ----------
rm -f "$RAW_OUT" "$VERDICT_JSON" "${STDERR_OUT}" "$BODY_FILE"

case "$VERDICT" in
  APPROVE|CONDITIONAL_APPROVE) exit 0 ;;
  REVISE|BLOCK)
    if [ "$FAIL_ON_REVISE" = "true" ]; then
      exit 1
    else
      exit 0
    fi
    ;;
  *) exit 2 ;;
esac
