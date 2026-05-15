#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { classify, readFiles } = require('./explain-review-route');

const DEFAULT_MAX_MEMORY_CHARS = 12000;
const DEFAULT_MAX_DIFF_CHARS = 18000;

function usage() {
  console.error([
    'Usage: build-context-pack.js [--out <dir>] [--files <path>] [--lines <n>]',
    '       [--mode skip|thin|full|deep] [--calibration <path>] [--task <text>]',
    '       [--max-memory-chars <n>] [--max-diff-chars <n>] [--ci] [--json]',
  ].join('\n'));
}

function parseArgs(argv) {
  const opts = {
    out: '',
    filesPath: '',
    linesChanged: null,
    modeOverride: '',
    calibrationPath: '',
    task: '',
    maxMemoryChars: DEFAULT_MAX_MEMORY_CHARS,
    maxDiffChars: DEFAULT_MAX_DIFF_CHARS,
    ci: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') {
      opts.out = path.resolve(argv[++i] || '');
    } else if (arg === '--files') {
      opts.filesPath = path.resolve(argv[++i] || '');
    } else if (arg === '--lines') {
      opts.linesChanged = Number.parseInt(argv[++i] || '0', 10);
    } else if (arg === '--mode') {
      opts.modeOverride = argv[++i] || '';
    } else if (arg === '--calibration') {
      opts.calibrationPath = path.resolve(argv[++i] || '');
    } else if (arg === '--task') {
      opts.task = argv[++i] || '';
    } else if (arg === '--max-memory-chars') {
      opts.maxMemoryChars = Number.parseInt(argv[++i] || `${DEFAULT_MAX_MEMORY_CHARS}`, 10);
    } else if (arg === '--max-diff-chars') {
      opts.maxDiffChars = Number.parseInt(argv[++i] || `${DEFAULT_MAX_DIFF_CHARS}`, 10);
    } else if (arg === '--ci') {
      opts.ci = true;
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

  if (opts.modeOverride && !['skip', 'thin', 'full', 'deep'].includes(opts.modeOverride)) {
    console.error(`Invalid --mode: ${opts.modeOverride}`);
    process.exit(2);
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

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file) {
  if (!file || !fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function defaultOutDir(root) {
  const project = path.basename(root);
  return path.join(root, '.forgeflow', project, 'context', 'latest');
}

function fileKind(file) {
  const lower = file.toLowerCase();
  if (/(\.test|\.spec)\.(ts|tsx|js|jsx)$/.test(lower) || /(^|\/)(tests|__tests__|e2e)\//.test(lower)) return 'test';
  if (/\.(md|mdx|txt|rst)$/.test(lower) || lower.startsWith('docs/') || /^readme(\.|$)/i.test(path.basename(file))) return 'docs';
  if (/\.(tsx|jsx|vue|svelte|css|scss)$/.test(lower) || /(^|\/)(components|pages|app|frontend|ui)\//.test(lower)) return 'frontend';
  if (/auth|passport|session|oauth|login|token|crypto|jwt|password|permission|rbac/.test(lower)) return 'security';
  if (/(^|\/)(migrations?|schema)\//.test(lower) || lower.endsWith('.sql')) return 'data';
  if (/\/(api|routes|controllers|services?|clients?|integrations?)\//.test(lower)) return 'service';
  return 'code';
}

function agentFocus(agent) {
  if (agent.startsWith('smith')) return ['code', 'data', 'test', 'service'];
  if (agent.startsWith('warden')) return ['security', 'service', 'data', 'code'];
  if (agent.startsWith('lumen')) return ['frontend', 'service', 'docs'];
  if (agent.startsWith('atlas')) return ['code', 'service', 'docs', 'test', 'frontend', 'security', 'data'];
  if (agent === 'aegis') return ['security', 'data', 'service', 'code'];
  return [];
}

function buildFileManifest(files, root) {
  return files.map((file) => {
    const abs = path.join(root, file);
    let stat = null;
    try {
      stat = fs.statSync(abs);
    } catch (_err) {
      stat = null;
    }
    return {
      path: file,
      kind: fileKind(file),
      exists: Boolean(stat),
      size_bytes: stat ? stat.size : null,
    };
  });
}

function readChangedFiles(opts) {
  return readFiles({
    filesPath: opts.filesPath,
    linesChanged: opts.linesChanged,
    modeOverride: opts.modeOverride,
    calibrationPath: opts.calibrationPath,
    ci: opts.ci,
  });
}

function buildDiffSummary(files, root, opts) {
  const parts = ['# Diff Summary', ''];
  if (opts.task) {
    parts.push(`Task: ${opts.task}`, '');
  }

  const nameStatus = opts.filesPath
    ? files.map((file) => `? ${file}`).join('\n')
    : git(['diff', '--name-status', 'HEAD'], root);
  const stat = opts.filesPath
    ? ''
    : git(['diff', '--stat', 'HEAD'], root);
  const numstat = opts.filesPath
    ? ''
    : git(['diff', '--numstat', 'HEAD'], root);

  parts.push('## Files', '');
  parts.push(nameStatus || files.map((file) => `- ${file}`).join('\n') || '(none)', '');
  if (numstat) {
    parts.push('## Numstat', '', fenced(numstat), '');
  }
  if (stat) {
    parts.push('## Stat', '', fenced(stat), '');
  }
  return truncate(parts.join('\n'), opts.maxDiffChars);
}

function fenced(value) {
  return ['```text', value, '```'].join('\n');
}

function keywords(files, route, task) {
  const words = new Set();
  for (const file of files) {
    for (const part of file.split(/[^A-Za-z0-9]+/)) {
      if (part.length >= 4) words.add(part.toLowerCase());
    }
  }
  for (const reason of route.reasons || []) {
    for (const part of reason.split(/[^A-Za-z0-9]+/)) {
      if (part.length >= 5) words.add(part.toLowerCase());
    }
  }
  for (const part of String(task || '').split(/[^A-Za-z0-9]+/)) {
    if (part.length >= 4) words.add(part.toLowerCase());
  }
  return [...words].slice(0, 80);
}

function memoryFiles(root) {
  const project = path.basename(root);
  const dir = path.join(root, '.forgeflow', project);
  return [
    'current-discussion.md',
    'current-research.md',
    'current-plan.md',
    'current-brief.md',
    'patterns.md',
    'codebase-map.md',
    'review-history.md',
    'learnings.jsonl',
  ].map((name) => path.join(dir, name));
}

function buildMemoryHits(root, files, route, task, maxChars) {
  const keys = keywords(files, route, task);
  const hits = [];
  for (const file of memoryFiles(root)) {
    if (!fs.existsSync(file)) continue;
    const rel = path.relative(root, file);
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i].trim();
      if (!line) continue;
      const lower = line.toLowerCase();
      const score = keys.reduce((sum, key) => sum + (lower.includes(key) ? 1 : 0), 0);
      if (score > 0 || /^#{1,3}\s/.test(line)) {
        hits.push({ source: rel, line: i + 1, score, text: line });
      }
    }
  }

  const selected = hits
    .sort((a, b) => b.score - a.score || a.source.localeCompare(b.source) || a.line - b.line)
    .slice(0, 80);
  const rendered = ['# Memory Hits', '', `Keywords: ${keys.join(', ') || '(none)'}`, ''];
  for (const hit of selected) {
    rendered.push(`- ${hit.source}:${hit.line} ${hit.text}`);
  }
  if (selected.length === 0) {
    rendered.push('(no local memory hits)');
  }
  return truncate(rendered.join('\n'), maxChars);
}

function truncate(text, maxChars) {
  if (!Number.isFinite(maxChars) || maxChars <= 0 || text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 80)).trimEnd()}\n\n[truncated to ${maxChars} chars]`;
}

function rulePack(agent, route, manifest) {
  const kinds = new Set(manifest.map((file) => file.kind));
  const rules = [];
  if (agent.startsWith('smith')) {
    rules.push('Check correctness, decomposition, naming, data integrity, migrations, and test fit.');
    if (kinds.has('data')) rules.push('Data rule: treat migrations/schema changes as high-risk and require rollback/data-loss reasoning.');
  }
  if (agent.startsWith('warden')) {
    rules.push('Check auth, validation, permissions, secret handling, command/file/network boundaries, and reuse.');
    if (route.verifier === 'required') rules.push('Verifier rule: make only evidence-backed high-risk claims; Aegis will verify them.');
  }
  if (agent.startsWith('lumen')) {
    rules.push('Check accessibility, interaction states, responsive layout, user-facing copy, and service connectivity.');
    if (kinds.has('frontend')) rules.push('Frontend rule: include keyboard, focus, contrast, loading/error/empty states, and mobile layout.');
  }
  if (agent.startsWith('atlas')) {
    rules.push('Check scope drift, handoffs, memory relevance, prior patterns, and cross-agent coverage gaps.');
  }
  if (agent === 'aegis') {
    rules.push('Verify only visible evidence. Reject speculative findings and require file/line grounding.');
  }
  if (route.mode === 'deep-mode') {
    rules.push('Deep-mode rule: widen scrutiny for auth, schema, crypto, permissions, and irreversible changes.');
  }
  return rules;
}

function relevantFilesForAgent(agent, manifest) {
  const focus = agentFocus(agent);
  if (focus.length === 0) return manifest;
  const selected = manifest.filter((file) => focus.includes(file.kind));
  return selected.length > 0 ? selected : manifest.slice(0, 10);
}

function packetMarkdown(agent, route, manifest, diffSummary, memoryHits, task) {
  const relevant = relevantFilesForAgent(agent, manifest);
  const rules = rulePack(agent, route, manifest);
  return [
    `# Forgeflow Context Packet: ${agent}`,
    '',
    '## Task',
    task || '(no explicit task provided)',
    '',
    '## Route',
    `- mode: ${route.mode}`,
    `- verifier: ${route.verifier}`,
    `- reasons: ${(route.reasons || []).join('; ') || '(none)'}`,
    `- telemetry: ${(route.telemetry_hints || []).map((hint) => `${hint.type}:${hint.class}`).join(', ') || '(none)'}`,
    '',
    '## Relevant Files',
    ...relevant.map((file) => `- ${file.path} (${file.kind}, ${file.exists ? `${file.size_bytes} bytes` : 'missing'})`),
    '',
    '## Local Rule Pack',
    ...rules.map((rule) => `- ${rule}`),
    '',
    '## Memory Hits',
    memoryHits.replace(/^# Memory Hits\s*/u, '').trim() || '(none)',
    '',
    '## Diff Summary',
    diffSummary.replace(/^# Diff Summary\s*/u, '').trim() || '(none)',
    '',
    '## Output Contract',
    '- Cite concrete files and lines when making findings.',
    '- Keep findings scoped to this packet unless you explicitly request expanded context.',
    '- Separate confirmed issues from questions and assumptions.',
  ].join('\n');
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function buildContextPack(opts) {
  const root = repoRoot();
  const files = readChangedFiles(opts);
  const calibration = readJson(opts.calibrationPath);
  const route = classify(files, {
    filesPath: opts.filesPath,
    linesChanged: opts.linesChanged,
    modeOverride: opts.modeOverride,
    calibration,
    ci: opts.ci,
  });
  const outDir = opts.out || defaultOutDir(root);
  const packetDir = path.join(outDir, 'agent-packets');
  ensureDir(packetDir);

  const manifest = buildFileManifest(route.files, root);
  const diffSummary = buildDiffSummary(route.files, root, opts);
  const memoryHits = buildMemoryHits(root, route.files, route, opts.task, opts.maxMemoryChars);
  const agents = route.agents.included || [];
  const packets = {};

  for (const agent of agents) {
    const content = packetMarkdown(agent, route, manifest, diffSummary, memoryHits, opts.task);
    const file = path.join(packetDir, `${agent}.md`);
    fs.writeFileSync(file, content);
    packets[agent] = path.relative(root, file);
  }

  const synthesisInput = {
    schema_version: '1',
    generated_at: new Date().toISOString(),
    repo_root: root,
    route_path: path.relative(root, path.join(outDir, 'route.json')),
    diff_summary_path: path.relative(root, path.join(outDir, 'diff-summary.md')),
    memory_hits_path: path.relative(root, path.join(outDir, 'memory-hits.md')),
    file_manifest_path: path.relative(root, path.join(outDir, 'file-manifest.json')),
    agent_packets: packets,
    limits: {
      max_memory_chars: opts.maxMemoryChars,
      max_diff_chars: opts.maxDiffChars,
    },
  };

  writeJson(path.join(outDir, 'route.json'), route);
  writeJson(path.join(outDir, 'file-manifest.json'), { schema_version: '1', files: manifest });
  fs.writeFileSync(path.join(outDir, 'diff-summary.md'), `${diffSummary}\n`);
  fs.writeFileSync(path.join(outDir, 'memory-hits.md'), `${memoryHits}\n`);
  writeJson(path.join(outDir, 'synthesis-input.json'), synthesisInput);

  return {
    out_dir: outDir,
    route,
    manifest,
    synthesis_input: synthesisInput,
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildContextPack(opts);
  if (opts.json) {
    console.log(JSON.stringify({
      out_dir: result.out_dir,
      mode: result.route.mode,
      agents: result.route.agents.included,
      packet_count: Object.keys(result.synthesis_input.agent_packets).length,
    }, null, 2));
  } else {
    console.log(`Context pack: ${result.out_dir}`);
    console.log(`Route: ${result.route.mode}`);
    console.log(`Agent packets: ${Object.keys(result.synthesis_input.agent_packets).join(', ') || 'none'}`);
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
  buildContextPack,
  fileKind,
  rulePack,
};
