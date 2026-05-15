#!/usr/bin/env node
// Forgeflow Telemetry — PostToolUse hook
//
// Records Forgeflow events to ~/.claude/projects/<sanitized-cwd>/memory/forgeflow-metrics.jsonl
// so /forgeflow-metrics can summarize usage over time.
//
// Event schema (one JSON per line):
//   {
//     "ts": "<ISO8601>",
//     "session_id": "<claude-session-id>",
//     "project": "<basename of cwd>",
//     "cwd": "<full cwd>",
//     "event": "command-invoked" | "command-completed" | "verdict" | "auto-fix-round" | "fleet-shard-complete" | "finding-overturned",
//     "command": "/review" | "/review-auto" | "/fleet" | "/ui-iterate" | "/handoff" | "/ship" | ...,
//     "detail": { ... event-specific fields ... }
//   }
//
// finding-overturned detail schema (requires Arbiter emits the structured tag line):
//   { overturned_reviewer: "<agent name>", finding_class: "<class label>", finding: "<brief>" }
//
// Events emitted from the PostToolUse lane (this hook):
//   - command-invoked: detected via Bash tool calls matching `/review`, `/fleet`, etc.
//   - verdict: detected in Agent tool outputs matching APPROVE/REVISE/BLOCK/CONFIRM/CHALLENGE
//   - auto-fix-round: detected in Agent tool outputs matching "chore(auto-fix): round N"
//
// Never fails or blocks — all I/O wrapped in try/catch, exits 0 on any error.

const fs = require('fs');
const path = require('path');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 1500);

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const cwd = data.cwd || process.cwd();
    const sessionId = data.session_id || 'unknown';
    const toolName = data.tool_name;
    const toolInput = data.tool_input || {};
    const toolOutput = typeof data.tool_output === 'string'
      ? data.tool_output
      : JSON.stringify(data.tool_output || '');

    // Only instrument forgeflow-related activity
    const projectName = path.basename(cwd);
    const events = detectEvents(toolName, toolInput, toolOutput);
    if (events.length === 0) {
      process.exit(0);
    }

    // Resolve metrics file path
    const home = process.env.HOME || '';
    if (!home) process.exit(0);
    const sanitizedCwd = cwd.replace(/\//g, '-');
    const metricsDir = path.join(home, '.claude', 'projects', sanitizedCwd, 'memory');
    const metricsFile = path.join(metricsDir, 'forgeflow-metrics.jsonl');

    // Ensure dir exists (best-effort)
    try { fs.mkdirSync(metricsDir, { recursive: true }); } catch (_) {}

    const ts = new Date().toISOString();
    const lines = events.map(ev => JSON.stringify({
      schema_version: '1',
      ts,
      session_id: sessionId,
      project: projectName,
      cwd,
      ...ev
    }));

    // Append atomically
    try {
      fs.appendFileSync(metricsFile, lines.join('\n') + '\n');
    } catch (_) { /* fail-open */ }
  } catch (_) { /* fail-open on any error */ }
  process.exit(0);
});

function detectEvents(toolName, toolInput, toolOutput) {
  const events = [];

  // Bash-emitted events: command invocations via slash commands are hard to detect
  // since they run through the CLI. We detect command invocations indirectly by
  // looking at Agent tool calls which carry the subagent name in the prompt.
  if (toolName === 'Agent') {
    const subagent = toolInput.subagent_type || '';

    // Verdict detection from Agent outputs
    const arbiterVerdict = toolOutput.match(/Forgeflow:\s*(APPROVED|APPROVE|REVISE|BLOCK)/i)
      || toolOutput.match(/Final Verdict:\s*(APPROVE|REVISE|BLOCK)/i)
      || toolOutput.match(/Arbiter['']?s? Verdict:\s*(APPROVE|CONDITIONAL APPROVE|REVISE|BLOCK)/i);
    if (arbiterVerdict) {
      let rawVerdict = arbiterVerdict[1].toUpperCase();
      if (rawVerdict === 'APPROVED') rawVerdict = 'APPROVE';
      events.push({
        event: 'verdict',
        command: '/review',
        detail: { reviewer: 'arbiter', verdict: rawVerdict }
      });
    }

    const compassVerdict = toolOutput.match(/Compass['']?s? (?:Final )?Verdict[:\s]+(CONFIRM|CHALLENGE)/i);
    if (compassVerdict) {
      events.push({
        event: 'verdict',
        command: '/review',
        detail: { reviewer: 'compass', verdict: compassVerdict[1].toUpperCase() }
      });
    }

    // Finding overturned detection (Arbiter dismisses a reviewer's finding).
    // Requires Arbiter's output to contain explicit tag lines in format:
    //   - REVIEWER: <agent> | CLASS: <class> | FINDING: <brief>
    // under a section header like "## Overturned Findings" or similar.
    // If Arbiter's prompts don't emit this tag, no events fire (fail-open).
    const overturnPattern = /^-\s*REVIEWER:\s*([^|]+?)\s*\|\s*CLASS:\s*([^|]+?)\s*\|\s*FINDING:\s*(.+?)\s*$/gm;
    let overturnMatch;
    while ((overturnMatch = overturnPattern.exec(toolOutput)) !== null) {
      events.push({
        event: 'finding-overturned',
        command: '/review',
        detail: {
          overturned_reviewer: overturnMatch[1].trim(),
          finding_class: overturnMatch[2].trim(),
          finding: overturnMatch[3].trim().slice(0, 240)
        }
      });
    }

    // Agent dispatch telemetry — which implement agent was used for an auto-fix
    if (/-implement$/.test(subagent) && /SUCCESS:/.test(toolOutput)) {
      events.push({
        event: 'auto-fix-applied',
        command: '/review-auto',
        detail: { agent: subagent, success: true }
      });
    } else if (/-implement$/.test(subagent)
               && (/REQUIRES MULTI-FILE CHANGE/.test(toolOutput)
                   || /EDIT TARGET NOT FOUND/.test(toolOutput)
                   || /UNEXPECTED ERROR/.test(toolOutput))) {
      events.push({
        event: 'auto-fix-applied',
        command: '/review-auto',
        detail: { agent: subagent, success: false, reason: 'worker-aborted' }
      });
    }
  }

  // Bash-level detection for command invocations and commits
  if (toolName === 'Bash') {
    const command = toolInput.command || '';

    // Auto-fix commit detection (indicates /review-auto completed a round)
    const autoFixMatch = command.match(/chore\(auto-fix\): (?:apply Forgeflow items )?\(?round (\d+)\)?/);
    if (autoFixMatch) {
      events.push({
        event: 'auto-fix-round',
        command: '/review-auto',
        detail: { round: parseInt(autoFixMatch[1], 10) }
      });
    }

    // /fleet shard completion (detected via fleet-wt<N> worktree removal)
    const fleetMatch = command.match(/git worktree remove.*fleet-wt(\d+)/);
    if (fleetMatch) {
      events.push({
        event: 'fleet-shard-complete',
        command: '/fleet',
        detail: { shard: parseInt(fleetMatch[1], 10) }
      });
    }

    // /handoff invocation (detected via .claude/handoff.md write in close proximity to handoff command text)
    // Handled at Write tool level below instead.
  }

  // Write/Edit to .claude/handoff.md signals /handoff usage
  if ((toolName === 'Write' || toolName === 'Edit')
      && (toolInput.file_path || '').includes('/.claude/handoff.md')) {
    events.push({
      event: 'command-invoked',
      command: '/handoff',
      detail: { file: toolInput.file_path }
    });
  }

  // /ui-iterate report write signals iteration complete
  if ((toolName === 'Write' || toolName === 'Edit')
      && (toolInput.file_path || '').includes('/ui-iterations/')
      && /\.md$/.test(toolInput.file_path || '')) {
    events.push({
      event: 'command-invoked',
      command: '/ui-iterate',
      detail: { report: toolInput.file_path }
    });
  }

  return events;
}
