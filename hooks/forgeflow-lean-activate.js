#!/usr/bin/env node
// Forgeflow Lean Activation — SessionStart/UserPromptSubmit hook
//
// Emits compact lean guidance on session start and tracks mode changes from
// user prompts. It writes a small active-mode flag that forgeflow-statusline.js
// can display. The hook is best-effort and never blocks a session.

const fs = require('fs');
const os = require('os');
const path = require('path');

function helperDir() {
  const candidates = [
    path.join(__dirname, '..', 'forgeflow', 'scripts', 'forgeflow'),
    path.join(__dirname, '..', 'scripts', 'forgeflow'),
    path.join(process.cwd(), 'scripts', 'forgeflow'),
    path.join(os.homedir(), '.claude', 'forgeflow', 'scripts', 'forgeflow'),
  ];
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'render-lean-session.js'))) || candidates[0];
}

function loadSessionHelper() {
  return require(path.join(helperDir(), 'render-lean-session.js'));
}

function stateDir() {
  if (process.env.FORGEFLOW_LEAN_STATE_DIR) return process.env.FORGEFLOW_LEAN_STATE_DIR;
  if (process.env.PLUGIN_DATA) return process.env.PLUGIN_DATA;
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(claudeDir, 'forgeflow');
}

function statePath() {
  return path.join(stateDir(), 'lean-active.json');
}

function writeState(profile, source) {
  fs.mkdirSync(stateDir(), { recursive: true });
  fs.writeFileSync(statePath(), JSON.stringify({
    schema_version: '1',
    profile,
    source,
    updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  }, null, 2));
}

function clearState() {
  try {
    fs.unlinkSync(statePath());
  } catch (_err) {}
}

function rootFromPayload(payload) {
  const dir = payload.cwd
    || (payload.workspace && (payload.workspace.current_dir || payload.workspace.project_dir))
    || process.cwd();
  return path.resolve(dir);
}

function projectDirForRoot(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function hookEventName(payload) {
  return payload.hook_event_name || payload.hookEventName || payload.event || '';
}

function hookOutput(eventName, profile, context) {
  process.stdout.write(JSON.stringify({
    systemMessage: profile ? `LEAN:${profile}` : 'LEAN:off',
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: context || '',
    },
  }));
}

function profileFromPrompt(prompt) {
  const text = String(prompt || '').trim().toLowerCase();
  if (/\b(stop lean|lean off|normal mode)\b/.test(text)) return 'off';
  const match = text.match(/^[/@$](?:forgeflow-)?lean(?:-mode)?(?:\s+|:)(lite|balanced|strict|ultra|off)\b/)
    || text.match(/^[/@$]forgeflow-lean-mode\s+--profile\s+(lite|balanced|strict|ultra|off)\b/);
  return match ? match[1] : '';
}

function handleSessionStart(payload) {
  const root = rootFromPayload(payload);
  const { buildLeanSession } = loadSessionHelper();
  const session = buildLeanSession({ root, projectDir: projectDirForRoot(root) });
  if (!session.enabled) {
    clearState();
    hookOutput('SessionStart', 'off', '');
    return;
  }
  writeState(session.profile, session.source);
  hookOutput('SessionStart', session.profile, session.instructions);
}

function handlePrompt(payload) {
  const mode = profileFromPrompt(payload.prompt || payload.message || payload.text || '');
  if (!mode) return;
  if (mode === 'off') {
    clearState();
    hookOutput('UserPromptSubmit', 'off', 'Forgeflow lean guidance off.');
    return;
  }
  writeState(mode, 'prompt');
  hookOutput('UserPromptSubmit', mode, `Forgeflow lean mode changed: ${mode}`);
}

function main() {
  let input = '';
  const timer = setTimeout(() => process.exit(0), 3000);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    clearTimeout(timer);
    try {
      const payload = input.trim() ? JSON.parse(input.replace(/^\uFEFF/, '')) : {};
      const event = hookEventName(payload);
      if (event === 'SessionStart' || !event) handleSessionStart(payload);
      else if (event === 'UserPromptSubmit') handlePrompt(payload);
    } catch (_err) {
      process.exit(0);
    }
  });
}

if (require.main === module) main();

module.exports = {
  clearState,
  hookEventName,
  profileFromPrompt,
  statePath,
  writeState,
};
