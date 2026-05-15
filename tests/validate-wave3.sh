#!/bin/bash
# validate-wave3.sh — Wave 3 regression checks.
# Verifies that all 7 command files carry the correct init-session.sh source line
# and that the command name string embedded in that line matches the file name.
#
# Usage: bash /home/user/example-project/tests/validate-wave3.sh
# Exit code: 0 if all checks pass, 1 if any fail.

set -euo pipefail

COMMANDS_DIR="/home/user/example-project/commands"

# The 7 command files covered by Wave 3 (consult was the reference; 6 are new)
FILES=(
  "consult.md"
  "discuss.md"
  "research.md"
  "plan.md"
  "implement.md"
  "review.md"
  "ship.md"
)

PASS=0
FAIL=0

# ─── helpers ────────────────────────────────────────────────────────────────

pass() { echo "  PASS  $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL  $1"; FAIL=$((FAIL + 1)); }

# ─── check_file <filename> ──────────────────────────────────────────────────

check_file() {
  local filename="$1"
  local filepath="${COMMANDS_DIR}/${filename}"
  # Derive expected command name by stripping the .md extension
  local expected_cmd="${filename%.md}"

  echo ""
  echo "[$filename]"

  # 1. File exists
  if [ ! -f "$filepath" ]; then
    fail "file not found: $filepath"
    return
  fi
  pass "file exists"

  # 2. Source line is present
  local source_line
  source_line=$(grep -n 'source.*init-session\.sh' "$filepath" || true)
  if [ -z "$source_line" ]; then
    fail "source line missing"
    return
  fi
  pass "source line present"

  # 3. Source line has the correct canonical form
  #    Expected pattern (single-quoted to avoid shell interpretation):
  #    source "$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel 2>/dev/null)/services/chat-bridge/init-session.sh" "<cmd>" "$*"
  local canonical_pattern
  canonical_pattern='source.*git.*rev-parse.*show-toplevel.*init-session\.sh.*"'"$expected_cmd"'".*"\$\*"'
  if echo "$source_line" | grep -qE "$canonical_pattern"; then
    pass "source line form correct"
  else
    fail "source line form incorrect (command name embedded or path wrong)"
    echo "        found:    $source_line"
    echo "        expected: ...init-session.sh \"$expected_cmd\" \"\$*\""
  fi

  # 4. Command name in source line matches file name
  #    Extract the first quoted argument after init-session.sh"
  local embedded_cmd
  embedded_cmd=$(echo "$source_line" | grep -oP '(?<=init-session\.sh"\s")[^"]+' || true)
  # Fallback: try single-space separator if lookahead failed
  if [ -z "$embedded_cmd" ]; then
    embedded_cmd=$(echo "$source_line" | sed 's/.*init-session\.sh" "\([^"]*\)".*/\1/' || true)
  fi

  if [ "$embedded_cmd" = "$expected_cmd" ]; then
    pass "command name matches file name ('$embedded_cmd')"
  else
    fail "command name mismatch: embedded='$embedded_cmd', expected='$expected_cmd'"
  fi

  # 5. YAML front matter is parseable (name field present and non-empty)
  local yaml_name
  yaml_name=$(awk '/^---/{found++; next} found==1 && /^name:/{print $2; exit}' "$filepath" || true)
  if [ -n "$yaml_name" ]; then
    pass "YAML front matter parseable (name: $yaml_name)"
  else
    fail "YAML front matter missing or 'name' field not found"
  fi

  # 6. <objective> tag is present (position integrity)
  if grep -q '<objective>' "$filepath"; then
    pass "<objective> tag present"
  else
    fail "<objective> tag missing"
  fi

  # 7. Source line appears AFTER the closing --- of the YAML block
  #    (must be inside the bash code fence, not before the front matter)
  local yaml_end_line source_line_num
  yaml_end_line=$(awk '/^---/{count++; if(count==2){print NR; exit}}' "$filepath")
  source_line_num=$(grep -n 'source.*init-session\.sh' "$filepath" | head -1 | cut -d: -f1)
  if [ -n "$yaml_end_line" ] && [ -n "$source_line_num" ]; then
    if [ "$source_line_num" -gt "$yaml_end_line" ]; then
      pass "source line is after YAML front matter (line $source_line_num > $yaml_end_line)"
    else
      fail "source line appears before or inside YAML front matter (line $source_line_num, YAML ends $yaml_end_line)"
    fi
  else
    fail "could not determine YAML end line or source line number"
  fi
}

# ─── main ───────────────────────────────────────────────────────────────────

echo "Wave 3 — Command file regression checks"
echo "========================================"
echo "Commands dir: $COMMANDS_DIR"

for f in "${FILES[@]}"; do
  check_file "$f"
done

echo ""
echo "========================================"
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
