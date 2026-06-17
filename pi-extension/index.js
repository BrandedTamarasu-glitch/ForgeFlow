import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildLeanSession } = require('../scripts/forgeflow/render-lean-session.js');
const { normalizeProfile } = require('../scripts/forgeflow/lean-config.js');

const DEFAULT_MODE = 'balanced';
const COMMANDS = [
  'forgeflow-lean-mode',
  'forgeflow-lean-review',
  'forgeflow-lean-audit',
  'forgeflow-lean-debt',
  'forgeflow-lean-status',
];

function normalizeMode(mode) {
  try {
    return normalizeProfile(mode) || '';
  } catch (_err) {
    return '';
  }
}

export function parseForgeflowLeanCommand(text, defaultMode = DEFAULT_MODE) {
  const fallback = normalizeMode(defaultMode) || DEFAULT_MODE;
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) return { type: 'set-mode', mode: fallback === 'off' ? DEFAULT_MODE : fallback };
  const [primary, secondary] = normalized.split(/\s+/);
  if (primary === 'status') return { type: 'status' };
  if (primary === 'default') {
    const mode = normalizeMode(secondary);
    return mode ? { type: 'set-default', mode } : { type: 'invalid', reason: 'invalid-default-mode' };
  }
  const mode = normalizeMode(primary);
  return mode ? { type: 'set-mode', mode } : { type: 'invalid', reason: 'invalid-mode', mode: primary };
}

export function resolveSessionMode(entries, fallbackMode = DEFAULT_MODE) {
  const fallback = normalizeMode(fallbackMode) || DEFAULT_MODE;
  if (!Array.isArray(entries)) return fallback;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry?.type !== 'custom' || entry?.customType !== 'forgeflow-lean-mode') continue;
    const mode = normalizeMode(entry?.data?.mode);
    if (mode) return mode;
  }
  return fallback;
}

function sendAlias(skillName, args, ctx) {
  const normalized = String(args || '').trim();
  const message = normalized ? `${skillName} ${normalized}` : skillName;
  if (ctx?.isIdle?.() === false) {
    ctx?.pi?.sendUserMessage?.(message, { deliverAs: 'followUp' });
    ctx?.ui?.notify?.(`${skillName} queued as follow-up.`, 'info');
    return;
  }
  ctx?.pi?.sendUserMessage?.(message);
}

export function commandNames() {
  return COMMANDS.slice();
}

export default function forgeflowPiExtension(pi) {
  let currentMode = DEFAULT_MODE;
  let configuredDefaultMode = DEFAULT_MODE;

  const setMode = (mode, ctx) => {
    const normalized = normalizeMode(mode);
    if (!normalized) return;
    currentMode = normalized;
    pi.appendEntry?.('forgeflow-lean-mode', { mode: normalized });
    ctx?.ui?.notify?.(`Forgeflow lean mode set to ${normalized}.`, 'info');
  };

  pi.registerCommand?.('forgeflow-lean-mode', {
    description: 'Set or report Forgeflow lean mode',
    handler: async (args, ctx) => {
      const parsed = parseForgeflowLeanCommand(args, configuredDefaultMode);
      if (parsed.type === 'status') {
        ctx?.ui?.notify?.(`Forgeflow lean: current ${currentMode} default ${configuredDefaultMode}`, 'info');
        return;
      }
      if (parsed.type === 'set-default') {
        configuredDefaultMode = parsed.mode;
        ctx?.ui?.notify?.(`Default Forgeflow lean mode set to ${configuredDefaultMode}.`, 'info');
        return;
      }
      if (parsed.type === 'set-mode') {
        setMode(parsed.mode, ctx);
        return;
      }
      ctx?.ui?.notify?.('Unknown or unsupported Forgeflow lean mode.', 'warning');
    },
  });

  pi.registerCommand?.('forgeflow-lean-review', {
    description: 'Run /forgeflow-lean-review',
    handler: (args, ctx) => sendAlias('/forgeflow-lean-review', args, { ...ctx, pi }),
  });
  pi.registerCommand?.('forgeflow-lean-audit', {
    description: 'Run /forgeflow-lean-audit',
    handler: (args, ctx) => sendAlias('/forgeflow-lean-audit', args, { ...ctx, pi }),
  });
  pi.registerCommand?.('forgeflow-lean-debt', {
    description: 'Run /forgeflow-lean-debt',
    handler: (args, ctx) => sendAlias('/forgeflow-lean-debt', args, { ...ctx, pi }),
  });
  pi.registerCommand?.('forgeflow-lean-status', {
    description: 'Run /forgeflow-lean-status',
    handler: (args, ctx) => sendAlias('/forgeflow-lean-status', args, { ...ctx, pi }),
  });

  pi.on?.('input', async (event) => {
    if (event?.source === 'extension') return;
    const text = String(event?.text || '');
    if (currentMode !== 'off' && /\b(stop lean|lean off|normal mode)\b/i.test(text)) setMode('off');
  });

  pi.on?.('session_start', async (_event, ctx) => {
    const entries = ctx?.sessionManager?.getBranch?.() || ctx?.sessionManager?.getEntries?.() || [];
    currentMode = resolveSessionMode(entries, configuredDefaultMode);
  });

  pi.on?.('before_agent_start', async (event) => {
    if (!currentMode || currentMode === 'off') return undefined;
    const session = buildLeanSession({ root: process.cwd(), profile: currentMode });
    return { systemPrompt: `${event.systemPrompt || ''}\n\n${session.instructions}` };
  });
}
