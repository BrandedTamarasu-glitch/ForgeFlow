#!/usr/bin/env node
// Forgeflow Telemetry — PostToolUse hook
//
// Records Forgeflow events to the active runtime metrics root:
//   Claude Code: ~/.claude/projects/<sanitized-cwd>/memory/forgeflow-metrics.jsonl
//   Codex:       ~/.codex/projects/<sanitized-cwd>/memory/forgeflow-metrics.jsonl
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
// Hook input remains fail-open. The explicit record-verdict CLI validates saved
// outcomes and exits nonzero on invalid input or recording failure.

const fs = require('fs');
const path = require('path');

function normalizeRuntime(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'codex') return 'codex';
  return 'claude-code';
}

function metricsRootForRuntime(runtime, env = process.env) {
  if (env.FORGEFLOW_METRICS_ROOT) return path.resolve(env.FORGEFLOW_METRICS_ROOT);
  const home = env.HOME || '';
  if (!home) return '';
  if (runtime === 'codex') return path.join(env.CODEX_HOME || path.join(home, '.codex'), 'projects');
  return path.join(env.CLAUDE_HOME || path.join(home, '.claude'), 'projects');
}

function metricsFileForCwd(cwd, runtime, env = process.env) {
  const metricsRoot = metricsRootForRuntime(runtime, env);
  if (!metricsRoot) return '';
  const sanitizedCwd = String(cwd || '').replace(/\//g, '-');
  return path.join(metricsRoot, sanitizedCwd, 'memory', 'forgeflow-metrics.jsonl');
}

function recordEvents(data, env = process.env) {
  const cwd = data.cwd || process.cwd();
  const runtime = normalizeRuntime(data.runtime || env.FORGEFLOW_RUNTIME);
  const sessionId = data.session_id || 'unknown';
  const toolName = data.tool_name;
  const toolInput = data.tool_input || {};
  const toolOutput = typeof data.tool_output === 'string'
    ? data.tool_output
    : JSON.stringify(data.tool_output || '');
  const projectName = path.basename(cwd);
  const events = detectEvents(toolName, toolInput, toolOutput);
  if (events.length === 0) return { recorded: 0, metrics_file: metricsFileForCwd(cwd, runtime, env), runtime };

  const metricsFile = metricsFileForCwd(cwd, runtime, env);
  if (!metricsFile) return { recorded: 0, metrics_file: '', runtime };

  try { fs.mkdirSync(path.dirname(metricsFile), { recursive: true }); } catch (_) {}

  const ts = new Date().toISOString();
  const lines = events.map(ev => JSON.stringify({
    schema_version: '1',
    ts,
    session_id: sessionId,
    project: projectName,
    cwd,
    runtime,
    ...ev
  }));

  try {
    fs.appendFileSync(metricsFile, lines.join('\n') + '\n');
    return { recorded: lines.length, metrics_file: metricsFile, runtime };
  } catch (_) {
    return { recorded: 0, metrics_file: metricsFile, runtime };
  }
}

// Explicit Codex outcomes share the hook's schema and metrics location. Unlike
// inferred hook events, invalid explicit input is reported to the caller.
async function recordVerdict(data, env = process.env) {
  const allowed = { arbiter: ['APPROVE', 'CONDITIONAL APPROVE', 'REVISE', 'BLOCK'], compass: ['CONFIRM', 'CHALLENGE'] };
  if (!Object.hasOwn(allowed, data.reviewer) || !allowed[data.reviewer].includes(data.verdict)) throw new Error('Invalid reviewer/verdict pair');
  if (typeof data.event_id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(data.event_id)) throw new Error('A stable event-id is required');
  if (typeof data.session_id !== 'string' || !data.session_id.trim() || data.session_id.length > 200) throw new Error('A real session id is required');
  if (typeof data.command !== 'string' || !/^\/[a-z][a-z-]{0,63}$/.test(data.command)) throw new Error('A workflow command such as /review is required');
  const cwd = path.resolve(data.cwd || process.cwd());
  if (typeof data.evidence !== 'string' || !data.evidence.trim()) throw new Error('A saved evidence file is required');
  const evidenceFile = fs.realpathSync(path.resolve(cwd, data.evidence));
  const evidence = path.relative(fs.realpathSync(cwd), evidenceFile);
  if (evidence === '..' || evidence.startsWith(`..${path.sep}`) || path.isAbsolute(evidence) || !fs.statSync(evidenceFile).isFile()) throw new Error('Evidence must be a saved file inside the project');
  const metricsFile = metricsFileForCwd(cwd, 'codex', env);
  if (!metricsFile) throw new Error('Metrics root is unavailable');
  fs.mkdirSync(path.dirname(metricsFile), { recursive: true });
  const lock = `${metricsFile}.verdict-lock`;
  let descriptor;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { descriptor = fs.openSync(lock, 'wx', 0o600); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (attempt === 49) throw new Error('Verdict recording is busy; retry with the same event-id');
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  try {
    let prior = '';
    try { prior = fs.readFileSync(metricsFile, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const detail = { reviewer: data.reviewer, verdict: data.verdict, evidence };
    for (const line of prior.split('\n')) {
      let event;
      try { event = JSON.parse(line); } catch (_) { continue; }
      if (event.event_id !== data.event_id) continue;
      if (event.session_id !== data.session_id || event.command !== data.command || JSON.stringify(event.detail) !== JSON.stringify(detail)) throw new Error('Event-id already records a different outcome');
      return { recorded: 0, duplicate: true, event_id: data.event_id };
    }
    const event = { schema_version: '1', ts: new Date().toISOString(), session_id: data.session_id,
      project: path.basename(cwd), cwd, runtime: 'codex', event: 'verdict', event_id: data.event_id, command: data.command, detail };
    fs.appendFileSync(metricsFile, `${prior && !prior.endsWith('\n') ? '\n' : ''}${JSON.stringify(event)}\n`);
    return { recorded: 1, duplicate: false, event_id: data.event_id };
  } finally {
    fs.closeSync(descriptor);
    fs.unlinkSync(lock);
  }
}

async function verdictCli(args) {
  const names = { '--reviewer': 'reviewer', '--verdict': 'verdict', '--evidence': 'evidence', '--event-id': 'event_id', '--session': 'session_id', '--cwd': 'cwd', '--command': 'command' };
  const data = { session_id: process.env.FORGEFLOW_SESSION_ID || process.env.CODEX_THREAD_ID };
  for (let i = 0; i < args.length; i += 2) {
    if (!Object.hasOwn(names, args[i]) || !args[i + 1]) throw new Error('Usage: record-verdict --reviewer <arbiter|compass> --verdict <decision> --evidence <saved-file> --event-id <stable-outcome-id> --command </workflow> [--session <host-session-id>] [--cwd <project-root>]');
    data[names[args[i]]] = args[i + 1];
  }
  process.stdout.write(`${JSON.stringify(await recordVerdict(data))}\n`);
}

function main() {
  let input = '';
  const stdinTimeout = setTimeout(() => process.exit(0), 1500);

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', () => {
    clearTimeout(stdinTimeout);
    try {
      recordEvents(JSON.parse(input));
    } catch (_) { /* fail-open on any error */ }
    process.exit(0);
  });
}

if (require.main === module) {
  if (process.argv[2] === 'record-verdict') verdictCli(process.argv.slice(3)).catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
  else main();
}

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

module.exports = {
  detectEvents,
  metricsFileForCwd,
  metricsRootForRuntime,
  normalizeRuntime,
  recordEvents,
  recordVerdict
};
