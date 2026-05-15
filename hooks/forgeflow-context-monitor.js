#!/usr/bin/env node
// Forgeflow Context Monitor — PostToolUse hook
//
// Warns when context window usage approaches limits:
//   - 35% remaining: WARNING (65% used — compact soon)
//   - 25% remaining: CRITICAL (75% used — compact immediately)
//
// Context data is read from the statusline bridge file at /tmp/claude-ctx-{session_id}.json.
// PostToolUse hooks do not receive context_window directly — the statusline hook does.
// forgeflow-statusline.js writes this bridge file on every render. Configure it as
// your statusLine in ~/.claude/settings.json to activate this hook.
//
// Debounce: fires at most once per 5 tool uses per threshold per session.
// State tracked in /tmp/rs-ctx-{session_id}.json

const fs = require('fs');
const os = require('os');
const path = require('path');

const WARN_THRESHOLD = 35;   // % remaining — warning level
const CRIT_THRESHOLD = 25;   // % remaining — critical level
const DEBOUNCE_TOOLS = 5;    // minimum tool uses between advisories at same level

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const sessionId = data.session_id || 'unknown';

    // Read context data from the bridge file written by forgeflow-statusline.js
    const bridgePath = path.join(os.tmpdir(), `claude-ctx-${sessionId}.json`);
    let remaining = null;
    if (fs.existsSync(bridgePath)) {
      try {
        const bridge = JSON.parse(fs.readFileSync(bridgePath, 'utf8'));
        if (typeof bridge.remaining_percentage === 'number') {
          remaining = bridge.remaining_percentage;
        }
      } catch (_) {}
    }

    // No context data available (statusline not active or not yet rendered)
    if (remaining === null) {
      process.exit(0);
    }

    // ── Session state ──
    const stateFile = path.join(os.tmpdir(), `rs-ctx-${sessionId}.json`);
    let state = { toolCount: 0, lastWarnAt: -Infinity, lastCritAt: -Infinity };

    if (fs.existsSync(stateFile)) {
      try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch (_) {}
    }

    state.toolCount = (state.toolCount || 0) + 1;

    // ── Determine level ──
    let level = null;
    let lastAt = -Infinity;

    if (remaining <= CRIT_THRESHOLD) {
      level = 'CRITICAL';
      lastAt = state.lastCritAt || -Infinity;
    } else if (remaining <= WARN_THRESHOLD) {
      level = 'WARNING';
      lastAt = state.lastWarnAt || -Infinity;
    }

    if (!level) {
      fs.writeFileSync(stateFile, JSON.stringify(state));
      process.exit(0);
    }

    // Debounce: suppress if fewer than DEBOUNCE_TOOLS tool uses since last advisory at this level
    if (state.toolCount - lastAt < DEBOUNCE_TOOLS) {
      fs.writeFileSync(stateFile, JSON.stringify(state));
      process.exit(0);
    }

    // Update debounce marker
    if (level === 'CRITICAL') state.lastCritAt = state.toolCount;
    else state.lastWarnAt = state.toolCount;
    fs.writeFileSync(stateFile, JSON.stringify(state));

    const used = (100 - remaining).toFixed(0);
    const rem = Math.round(remaining);

    const message = level === 'CRITICAL'
      ? `Context window CRITICAL: ${used}% used, ${rem}% remaining. ` +
        'Run /compact Focus on [active feature] now to avoid auto-compaction data loss. ' +
        'Before compacting, save any critical values (stack traces, config, function names) to a file.'
      : `Context window WARNING: ${used}% used, ~${rem}% remaining. ` +
        'Consider running /compact Focus on [active feature] soon to preserve context quality.';

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: message
      }
    }));
  } catch (_) {
    process.exit(0);
  }
});
