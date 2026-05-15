#!/usr/bin/env node
// Forgeflow Statusline
//
// A minimal statusline that feeds context_window data to the context monitor hook.
// Writes /tmp/claude-ctx-{session_id}.json so forgeflow-context-monitor.js
// can issue context warnings without any GSD dependency.
//
// Configure as your statusLine in ~/.claude/settings.json:
//   "statusLine": { "type": "command", "command": "node ~/.claude/hooks/forgeflow-statusline.js" }
//
// If you already use another statusline (e.g. gsd-statusline.js), keep it —
// gsd-statusline.js already writes the same bridge file. Only one statusline
// can be active at a time, so do not configure both.

const fs = require('fs');
const os = require('os');
const path = require('path');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const session = data.session_id || '';
    const remaining = data.context_window?.remaining_percentage;
    const model = data.model?.display_name || 'Claude';
    const dir = path.basename(data.workspace?.current_dir || process.cwd());

    if (typeof remaining === 'number' && session) {
      const used = Math.round(100 - remaining);

      // Write bridge file for the context monitor PostToolUse hook
      try {
        const bridgePath = path.join(os.tmpdir(), `claude-ctx-${session}.json`);
        fs.writeFileSync(bridgePath, JSON.stringify({
          session_id: session,
          remaining_percentage: remaining,
          used_pct: used,
          timestamp: Math.floor(Date.now() / 1000)
        }));
      } catch (_) {}

      // Context bar (10 segments)
      const filled = Math.floor(used / 10);
      const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);
      let color;
      if (used < 65) color = '\x1b[32m';       // green
      else if (used < 75) color = '\x1b[33m';  // yellow
      else color = '\x1b[31m';                 // red

      process.stdout.write(`\x1b[2m${model}\x1b[0m | \x1b[2m${dir}\x1b[0m ${color}${bar} ${used}%\x1b[0m`);
    } else {
      // No context data yet — output minimal status
      process.stdout.write(`\x1b[2m${model}\x1b[0m | \x1b[2m${dir}\x1b[0m`);
    }
  } catch (_) {}
});
