#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  contextTelemetry,
  fileChars,
  sum,
  textChars,
  writeTelemetry,
} = require('./context-telemetry');

const DEFAULT_MAX_FILES_PER_LANE = 40;
const LANES = ['shared', 'smith', 'warden', 'lumen', 'compass', 'atlas'];

function usage() {
  console.error([
    'Usage: build-scope-manifest.js [--query <text>] [--files <path>] [--root <dir>]',
    '       [--out <path>] [--packet-dir <dir>] [--telemetry-out <path>]',
    '       [--max-files-per-lane <n>] [--json]',
  ].join('\n'));
}

function parseArgs(argv) {
  const opts = {
    query: '',
    filesPath: '',
    root: '',
    out: '',
    packetDir: '',
    telemetryOut: '',
    maxFilesPerLane: DEFAULT_MAX_FILES_PER_LANE,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--query') {
      opts.query = argv[++i] || '';
    } else if (arg === '--files') {
      opts.filesPath = path.resolve(argv[++i] || '');
    } else if (arg === '--root') {
      opts.root = path.resolve(argv[++i] || '');
    } else if (arg === '--out') {
      opts.out = path.resolve(argv[++i] || '');
    } else if (arg === '--packet-dir') {
      opts.packetDir = path.resolve(argv[++i] || '');
    } else if (arg === '--telemetry-out') {
      opts.telemetryOut = path.resolve(argv[++i] || '');
    } else if (arg === '--max-files-per-lane') {
      opts.maxFilesPerLane = Number.parseInt(argv[++i] || `${DEFAULT_MAX_FILES_PER_LANE}`, 10);
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      usage();
      process.exit(2);
    }
  }

  return opts;
}

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) return '';
  return result.stdout.trimEnd();
}

function repoRoot(cwd = process.cwd()) {
  return git(['rev-parse', '--show-toplevel'], cwd) || cwd;
}

function defaultOut(root) {
  return path.join(root, '.forgeflow', path.basename(root), 'context', 'scope-manifest.json');
}

function defaultPacketDir(root) {
  return path.join(root, '.forgeflow', path.basename(root), 'context', 'scope-packets');
}

function defaultTelemetryOut(root) {
  return path.join(root, '.forgeflow', path.basename(root), 'context', 'scope-telemetry.json');
}

function tokenize(value) {
  return [...new Set(String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length >= 3))];
}

function readFileList(filesPath, root) {
  if (filesPath) {
    return fs.readFileSync(filesPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  const tracked = git(['ls-files'], root).split(/\r?\n/).filter(Boolean);
  const changed = git(['diff', '--name-only', 'HEAD'], root).split(/\r?\n/).filter(Boolean);
  return [...new Set([...tracked, ...changed])];
}

function deniedPath(file) {
  const lower = file.toLowerCase();
  const base = path.basename(lower);
  if (!file || path.isAbsolute(file)) return 'absolute paths are not accepted';
  if (file.split(/[\\/]+/).includes('..')) return 'parent path segment is not accepted';
  if (/(^|\/)(\.git|node_modules|dist|build|coverage|\.next|\.turbo|vendor)\//.test(lower)) return 'generated or dependency path';
  if (/(^|\/)\.env($|[._-])/.test(lower)) return 'environment file';
  if (/\.(pem|key|p12|cert)$/i.test(base)) return 'private key or certificate';
  if (/\.(log|sqlite|db)$/i.test(base)) return 'local runtime artifact';
  if (/(password|secret|token)/i.test(base)) return 'sensitive filename';
  return '';
}

function fileKind(file) {
  const lower = file.toLowerCase();
  if (/^(\.agents|commands|scripts\/forgeflow|hooks|templates|project-rules|forgeflow-patterns)\//.test(lower)) return 'forgeflow';
  if (/(\.test|\.spec)\.(ts|tsx|js|jsx)$/.test(lower) || /(^|\/)(tests|__tests__|e2e)\//.test(lower)) return 'test';
  if (/\.(md|mdx|txt|rst)$/.test(lower) || lower.startsWith('docs/') || /^readme(\.|$)/i.test(path.basename(file))) return 'docs';
  if (/\.(tsx|jsx|vue|svelte|css|scss)$/.test(lower) || /(^|\/)(components|pages|app|frontend|ui)\//.test(lower)) return 'frontend';
  if (/auth|passport|session|oauth|login|crypto|jwt|permission|rbac/.test(lower)) return 'security';
  if (/(^|\/)(migrations?|schema)\//.test(lower) || lower.endsWith('.sql')) return 'data';
  if (/\/(api|routes|controllers|services?|clients?|integrations?)\//.test(lower)) return 'service';
  return 'code';
}

function laneSignals(file, kind) {
  const lower = file.toLowerCase();
  const signals = {};
  if (kind === 'test') {
    return { compass: ['test/validation'] };
  }
  if (['data', 'service', 'code'].includes(kind) || /model|repository|worker|queue|job/.test(lower)) signals.smith = ['backend/data/code'];
  if (kind === 'security' || /auth|session|oauth|jwt|permission|rbac|crypto|csrf|xss|ssrf|validation|middleware/.test(lower)) signals.warden = ['security/boundary'];
  if (kind === 'frontend' || /(^|\/)(components?|pages?|views?|ui)\//.test(lower) || /\.(css|scss)$/.test(lower) || /accessibility|a11y/.test(lower)) signals.lumen = ['frontend/ux'];
  if (/playwright|jest|vitest|cypress|spec|test|validation/.test(lower)) signals.compass = ['test/validation'];
  if (kind === 'docs' || kind === 'forgeflow' || /^\.forgeflow\//.test(lower)) signals.atlas = ['docs/coordination'];
  return signals;
}

function scoreFile(file, queryTokens) {
  if (queryTokens.length === 0) return 0;
  const lower = file.toLowerCase();
  return queryTokens.reduce((score, token) => score + (lower.includes(token) ? 1 : 0), 0);
}

function entryFor(root, file, queryTokens) {
  const abs = path.join(root, file);
  let stat = null;
  try {
    stat = fs.statSync(abs);
  } catch (_err) {
    stat = null;
  }
  const kind = fileKind(file);
  return {
    path: file,
    kind,
    exists: Boolean(stat),
    size_bytes: stat ? stat.size : null,
    score: scoreFile(file, queryTokens),
    signals: laneSignals(file, kind),
  };
}

function emptyLanes() {
  return Object.fromEntries(LANES.map((lane) => [lane, []]));
}

function addUnique(list, entry) {
  if (!list.some((item) => item.path === entry.path)) list.push(entry);
}

function laneList(entry) {
  return Object.keys(entry.signals).filter((lane) => lane !== 'atlas');
}

function entryLine(entry) {
  const signalText = Object.entries(entry.signals || {})
    .map(([lane, reasons]) => `${lane}:${reasons.join('+')}`)
    .join(', ') || 'none';
  const status = entry.exists ? `${entry.size_bytes} bytes` : 'missing';
  return `- ${entry.path} (${entry.kind}, ${status}, score ${entry.score}, signals ${signalText})`;
}

function renderScopePacket(lane, manifest) {
  const laneFiles = manifest.lanes[lane] || [];
  const sharedFiles = lane === 'shared' ? [] : manifest.lanes.shared || [];
  return [
    `# Forgeflow Scope Packet: ${lane}`,
    '',
    `Query: ${manifest.query || '(none)'}`,
    `Query tokens: ${manifest.query_tokens.join(', ') || '(none)'}`,
    '',
    '## Shared Files',
    ...(sharedFiles.length > 0 ? sharedFiles.map(entryLine) : ['(none)']),
    '',
    '## Lane Files',
    ...(laneFiles.length > 0 ? laneFiles.map(entryLine) : ['(none)']),
    '',
    '## Denied Files',
    ...(manifest.denied.length > 0 ? manifest.denied.map((entry) => `- ${entry.path}: ${entry.reason}`) : ['(none)']),
    '',
    '## Scope Rules',
    '- Treat this packet as the first-pass file ownership map.',
    '- Read listed files before broad discovery.',
    '- Ask Atlas or Arbiter to resolve gaps before editing unlisted files.',
  ].join('\n');
}

function writeScopePackets(manifest, packetDir) {
  fs.mkdirSync(packetDir, { recursive: true });
  const packets = {};
  for (const lane of LANES) {
    const file = path.join(packetDir, `${lane}.md`);
    fs.writeFileSync(file, `${renderScopePacket(lane, manifest)}\n`);
    packets[lane] = file;
  }
  return packets;
}

function buildScopeManifest(opts = {}) {
  const root = opts.root || repoRoot();
  const out = opts.out || defaultOut(root);
  const queryTokens = tokenize(opts.query || '');
  const files = readFileList(opts.filesPath || '', root);
  const lanes = emptyLanes();
  const denied = [];

  for (const file of files) {
    const rel = file.replace(/\\/g, '/');
    const reason = deniedPath(rel);
    if (reason) {
      denied.push({ path: rel, reason });
      continue;
    }
    const entry = entryFor(root, rel, queryTokens);
    const domainLanes = laneList(entry);
    if (domainLanes.length > 1) {
      addUnique(lanes.shared, entry);
    } else if (domainLanes.length === 1) {
      addUnique(lanes[domainLanes[0]], entry);
    } else if (entry.signals.atlas) {
      addUnique(lanes.atlas, entry);
    } else {
      addUnique(lanes.smith, entry);
    }
  }

  const maxFiles = Number.isFinite(opts.maxFilesPerLane) ? opts.maxFilesPerLane : DEFAULT_MAX_FILES_PER_LANE;
  for (const lane of LANES) {
    lanes[lane] = lanes[lane]
      .sort((a, b) => b.score - a.score || String(a.path).localeCompare(String(b.path)))
      .slice(0, maxFiles);
  }

  const manifest = {
    schema_version: '1',
    generated_at: new Date().toISOString(),
    root,
    query: opts.query || '',
    query_tokens: queryTokens,
    lanes,
    counts: Object.fromEntries(LANES.map((lane) => [lane, lanes[lane].length])),
    denied,
  };

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
  const packetDir = opts.packetDir || defaultPacketDir(root);
  const packets = writeScopePackets(manifest, packetDir);
  const packetChars = sum(Object.values(packets).map((file) => fileChars(file)));
  const manifestChars = textChars(JSON.stringify(manifest, null, 2));
  const telemetry = contextTelemetry('scope-manifest', {
    baseline_chars: manifestChars * LANES.length,
    compact_chars: packetChars,
    detail: {
      lanes: LANES.length,
      denied: denied.length,
      manifest_chars: manifestChars,
      packet_chars: packetChars,
      counts: manifest.counts,
    },
  });
  const telemetryOut = opts.telemetryOut || defaultTelemetryOut(root);
  writeTelemetry(telemetryOut, telemetry);
  return { out, packet_dir: packetDir, packets, telemetry_path: telemetryOut, telemetry, manifest };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildScopeManifest(opts);
  if (opts.json) {
    console.log(JSON.stringify({
      out: result.out,
      packet_dir: result.packet_dir,
      telemetry_path: result.telemetry_path,
      counts: result.manifest.counts,
      denied: result.manifest.denied.length,
      estimated_saved_tokens: result.telemetry.estimated_saved_tokens,
    }, null, 2));
  } else {
    console.log(`Scope manifest: ${result.out}`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.stack || err.message);
    process.exit(1);
  }
}

module.exports = {
  buildScopeManifest,
  deniedPath,
  fileKind,
  laneSignals,
  renderScopePacket,
  tokenize,
};
