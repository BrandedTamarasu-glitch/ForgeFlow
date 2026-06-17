import test from 'node:test';
import assert from 'node:assert/strict';
import forgeflowPiExtension, {
  commandNames,
  parseForgeflowLeanCommand,
  resolveSessionMode,
} from '../index.js';

function fakePi() {
  const commands = new Map();
  const handlers = new Map();
  const entries = [];
  const messages = [];
  return {
    commands,
    handlers,
    entries,
    messages,
    registerCommand(name, config) { commands.set(name, config); },
    on(name, handler) { handlers.set(name, handler); },
    appendEntry(type, data) { entries.push({ type: 'custom', customType: type, data }); },
    sendUserMessage(message, opts) { messages.push({ message, opts }); },
  };
}

test('parses lean mode commands', () => {
  assert.deepEqual(parseForgeflowLeanCommand('ultra'), { type: 'set-mode', mode: 'ultra' });
  assert.deepEqual(parseForgeflowLeanCommand('status'), { type: 'status' });
  assert.equal(parseForgeflowLeanCommand('default strict').mode, 'strict');
  assert.equal(parseForgeflowLeanCommand('unknown').type, 'invalid');
});

test('resolves latest session mode entry', () => {
  const entries = [
    { type: 'custom', customType: 'forgeflow-lean-mode', data: { mode: 'lite' } },
    { type: 'custom', customType: 'forgeflow-lean-mode', data: { mode: 'strict' } },
  ];
  assert.equal(resolveSessionMode(entries), 'strict');
  assert.equal(resolveSessionMode([], 'ultra'), 'ultra');
});

test('registers command surface and injects prompt guidance', async () => {
  const pi = fakePi();
  forgeflowPiExtension(pi);
  for (const name of commandNames()) assert.ok(pi.commands.has(name), `missing ${name}`);
  assert.ok(pi.handlers.has('before_agent_start'));

  await pi.commands.get('forgeflow-lean-mode').handler('ultra', { ui: { notify() {} } });
  assert.equal(pi.entries.at(-1).data.mode, 'ultra');
  const result = await pi.handlers.get('before_agent_start')({ systemPrompt: 'base' });
  assert.match(result.systemPrompt, /FORGEFLOW LEAN SESSION ACTIVE - profile: ultra/);

  await pi.handlers.get('input')({ text: 'normal mode' });
  assert.equal(pi.entries.at(-1).data.mode, 'off');
  const off = await pi.handlers.get('before_agent_start')({ systemPrompt: 'base' });
  assert.equal(off, undefined);
});

test('aliases commands into chat messages', async () => {
  const pi = fakePi();
  forgeflowPiExtension(pi);
  await pi.commands.get('forgeflow-lean-review').handler('--json', { isIdle: () => true, ui: { notify() {} } });
  assert.deepEqual(pi.messages.at(-1), { message: '/forgeflow-lean-review --json', opts: undefined });
});
