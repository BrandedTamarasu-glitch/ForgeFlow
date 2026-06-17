import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const { buildLeanSession } = require(path.join(root, 'scripts', 'forgeflow', 'render-lean-session.js'));

function configDir() {
  return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
}

function statePath() {
  return path.join(configDir(), 'forgeflow', 'lean-active');
}

function readMode() {
  try {
    const value = fs.readFileSync(statePath(), 'utf8').trim();
    return value || '';
  } catch (_err) {
    return '';
  }
}

function writeMode(mode) {
  fs.mkdirSync(path.dirname(statePath()), { recursive: true });
  fs.writeFileSync(statePath(), mode);
}

function commandMode(input) {
  const text = String(input || '').trim().toLowerCase();
  const match = text.match(/^(lite|balanced|strict|ultra|off)\b/);
  return match ? match[1] : '';
}

export default async function forgeflowLeanPlugin() {
  return {
    async 'experimental.chat.system.transform'(_input, output) {
      const mode = readMode();
      if (mode === 'off') return;
      const session = buildLeanSession({ root, projectDir: path.join(root, '.forgeflow', path.basename(root)), profile: mode || 'balanced' });
      if (!session.enabled) return;
      output.system = output.system || [];
      output.system.push(session.instructions);
    },
    async 'command.execute.before'(input) {
      if (!input || !['forgeflow-lean', 'forgeflow-lean-mode'].includes(input.command)) return;
      const mode = commandMode(input.arguments);
      if (mode) writeMode(mode);
    },
  };
}
