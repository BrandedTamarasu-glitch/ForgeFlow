#!/usr/bin/env node
// Forgeflow Statusline
//
// A statusline that feeds context_window data to the context monitor hook.
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

const AUTO_COMPACT_BUFFER_PCT = 16.5;

function normalizedUsedPct(remaining) {
  const usableRemaining = Math.max(
    0,
    ((remaining - AUTO_COMPACT_BUFFER_PCT) / (100 - AUTO_COMPACT_BUFFER_PCT)) * 100
  );
  return Math.max(0, Math.min(100, Math.round(100 - usableRemaining)));
}

function currentTask(session) {
  if (!session) return '';

  const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const todosDir = path.join(claudeDir, 'todos');
  if (!fs.existsSync(todosDir)) return '';

  try {
    const files = fs.readdirSync(todosDir)
      .filter(file => file.startsWith(session) && file.includes('-agent-') && file.endsWith('.json'))
      .map(file => ({ name: file, mtime: fs.statSync(path.join(todosDir, file)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) return '';

    const todos = JSON.parse(fs.readFileSync(path.join(todosDir, files[0].name), 'utf8'));
    const inProgress = todos.find(todo => todo.status === 'in_progress');
    return inProgress?.activeForm || '';
  } catch (_) {
    return '';
  }
}

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
    const task = currentTask(session);
    const middle = task
      ? `\x1b[1m${task}\x1b[0m | \x1b[2m${dir}\x1b[0m`
      : `\x1b[2m${dir}\x1b[0m`;

    if (typeof remaining === 'number' && session) {
      const used = normalizedUsedPct(remaining);

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
      let ctx;
      if (used < 50) {
        ctx = `\x1b[32m${bar} ${used}%\x1b[0m`;
      } else if (used < 65) {
        ctx = `\x1b[33m${bar} ${used}%\x1b[0m`;
      } else if (used < 80) {
        ctx = `\x1b[38;5;208m${bar} ${used}%\x1b[0m`;
      } else {
        ctx = `\x1b[5;31m${bar} ${used}%\x1b[0m`;
      }

      process.stdout.write(`\x1b[2m${model}\x1b[0m | ${middle} ${ctx}`);
    } else {
      // No context data yet — output minimal status
      process.stdout.write(`\x1b[2m${model}\x1b[0m | ${middle}`);
    }
  } catch (_) {}
});
