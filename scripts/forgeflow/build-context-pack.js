#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { classify, readFiles } = require('./explain-review-route');
const { buildCodeTopology } = require('./build-code-topology');
const { buildMemoryIndex } = require('./index-memory');
const { showProjectLearnings } = require('./show-project-learnings');
const { checkProjectLearnings } = require('./check-project-learnings');
const {
  attachCodeMapHistory,
  historyPathForTopologyOut,
  projectCodeMapSummary,
  renderProjectCodeMap,
} = require('./show-code-map');
const {
  contextTelemetry,
  fileChars,
  sum,
  textChars,
  writeTelemetry,
} = require('./context-telemetry');

const DEFAULT_MAX_MEMORY_CHARS = 8000;
const DEFAULT_MAX_DIFF_CHARS = 18000;

function usage() {
  console.error([
    'Usage: build-context-pack.js [--out <dir>] [--files <path>] [--lines <n>]',
    '       [--mode skip|thin|full|deep] [--calibration <path>] [--task <text>]',
    '       [--max-memory-chars <n>] [--max-diff-chars <n>] [--no-memory-index] [--ci] [--json]',
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
    memoryIndex: true,
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
    } else if (arg === '--no-memory-index') {
      opts.memoryIndex = false;
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

function md(value) {
  return String(value || '').replace(/([\\`*_{}\[\]()#+\-.!|>])/g, '\\$1');
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
  return [
    'current-discussion.md',
    'current-research.md',
    'current-plan.md',
    'current-brief.md',
    'implementation-notes.md',
    'project-learnings.md',
    'patterns.md',
    'codebase-map.md',
    'review-history.md',
    'learnings.jsonl',
  ].map((name) => path.join(defaultProjectDir(root), name));
}

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function defaultMemoryIndexPath(root) {
  return path.join(defaultProjectDir(root), 'index', 'memory-index.json');
}

function ensureMemoryIndex(root, enabled) {
  if (!enabled) return null;
  const projectDir = defaultProjectDir(root);
  if (!fs.existsSync(projectDir)) return null;
  try {
    const result = buildMemoryIndex({
      projectDir,
      out: defaultMemoryIndexPath(root),
    });
    return result.out;
  } catch (_err) {
    return null;
  }
}

function buildMemoryHitsFromIndex(root, indexPath, files, route, task, maxChars) {
  if (!indexPath || !fs.existsSync(indexPath)) return null;
  const index = readJson(indexPath);
  if (!index || !Array.isArray(index.records)) return null;
  const keys = keywords(files, route, task);
  const hits = [];

  for (const item of index.records) {
    const text = String(item.text || '');
    const haystack = `${text} ${item.source || ''} ${(item.keywords || []).join(' ')}`.toLowerCase();
    const score = keys.reduce((sum, key) => sum + (haystack.includes(key) ? 1 : 0), 0);
    if (score > 0 || item.kind === 'heading') {
      hits.push({
        source: item.source || '(unknown)',
        line: item.line || 1,
        score,
        kind: item.kind || 'memory',
        text,
      });
    }
  }

  const selected = hits
    .sort((a, b) => b.score - a.score || a.source.localeCompare(b.source) || a.line - b.line)
    .slice(0, 80);
  const rendered = [
    '# Memory Hits',
    '',
    `Index: ${path.relative(root, indexPath)}`,
    `Keywords: ${keys.join(', ') || '(none)'}`,
    '',
  ];
  for (const hit of selected) {
    rendered.push(`- ${hit.source}:${hit.line} [${hit.kind}] ${hit.text}`);
  }
  if (selected.length === 0) {
    rendered.push('(no local memory hits)');
  }
  return truncate(rendered.join('\n'), maxChars);
}

function buildMemoryHits(root, files, route, task, maxChars, indexPath = null) {
  const indexed = buildMemoryHitsFromIndex(root, indexPath, files, route, task, maxChars);
  if (indexed) return indexed;

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

function renderLatestInsightsGate(result, root) {
  const relProjectDir = path.relative(root, result.project_dir) || '.';
  const issues = result.issues.slice(0, 5).map((item) => `- ${item.severity.toUpperCase()} ${item.code}: ${item.message}`);
  return [
    '# Forgeflow Project Learnings - Quality Gate',
    '',
    `Project learnings were not injected because the quality check returned ${result.status.toUpperCase()}.`,
    'Agents should proceed from current files, tests, and review evidence instead of project-learning guidance.',
    '',
    `Check: scripts/forgeflow/check-project-learnings.js --project-dir ${relProjectDir} --json`,
    'Refresh/view: forgeflow-learnings --project',
    '',
    '## Issues',
    ...(issues.length > 0 ? issues : ['- No specific issues were reported.']),
  ].join('\n');
}

function latestInsightsReport(status, projectDir, root, check = null, reason = '') {
  const issues = check && Array.isArray(check.issues) ? check.issues : [];
  return {
    schema_version: '1',
    status,
    reason,
    generated_at: new Date().toISOString(),
    git: currentGitState(root),
    project_dir: projectDir ? path.relative(root, projectDir) || '.' : '',
    check_status: check ? check.status : '',
    issue_count: issues.length,
    issues: issues.slice(0, 10).map((item) => ({
      severity: item.severity,
      code: item.code,
      message: item.message,
      line: item.line || null,
    })),
  };
}

function currentGitState(root) {
  const topLevel = git(['rev-parse', '--show-toplevel'], root);
  if (!topLevel) {
    return {
      available: false,
      commit_short: '',
      dirty: false,
    };
  }
  const status = git(['status', '--short'], root).split(/\r?\n/).filter(Boolean);
  return {
    available: true,
    commit_short: git(['rev-parse', '--short', 'HEAD'], root),
    dirty: status.length > 0,
  };
}

function buildLatestInsightsResult(root, maxChars = 3000, opts = {}) {
  const projectDir = defaultProjectDir(root);
  if (!fs.existsSync(projectDir)) {
    return {
      markdown: '',
      report: latestInsightsReport('missing', projectDir, root, null, 'project-dir-missing'),
    };
  }
  try {
    const result = showProjectLearnings({ projectDir, refreshCodeMap: false, codeMap: opts.codeMap });
    const check = checkProjectLearnings({ projectDir });
    if (check.status !== 'pass') {
      return {
        markdown: truncate(renderLatestInsightsGate(check, root), maxChars),
        report: latestInsightsReport('blocked', projectDir, root, check, 'quality-check-not-passing'),
      };
    }
    return {
      markdown: truncate(result.markdown, maxChars),
      report: latestInsightsReport('injected', projectDir, root, check, 'quality-check-passing'),
    };
  } catch (err) {
    return {
      markdown: '',
      report: latestInsightsReport('error', projectDir, root, null, err.message),
    };
  }
}

function buildLatestInsights(root, maxChars = 3000) {
  return buildLatestInsightsResult(root, maxChars).markdown;
}

function firstLines(text, maxLines) {
  return String(text || '').split(/\r?\n/).slice(0, maxLines).join('\n');
}

function compactProjectCodeMap(root, maxChars = 2500) {
  const projectDir = defaultProjectDir(root);
  const codeMapPath = path.join(projectDir, 'context', 'project-code-map.md');
  const topologyPath = path.join(projectDir, 'context', 'code-topology.json');
  if (fs.existsSync(codeMapPath)) {
    return truncate([
      `Artifact: ${path.relative(root, codeMapPath)}`,
      '',
      firstLines(fs.readFileSync(codeMapPath, 'utf8').replace(/^# Forgeflow Project Code Map\s*/u, '').trim(), 80),
    ].join('\n'), maxChars);
  }
  const topology = readJson(topologyPath);
  if (!topology || !topology.summary) return '(none)';
  const lines = [
    `Artifact: ${path.relative(root, topologyPath)}`,
    `Summary: ${topology.summary.source_files} source files, ${topology.summary.local_edges} local edges, ${topology.summary.sections || 0} sections, ${topology.summary.changed_sections || 0} changed sections.`,
    '',
    'High fan-in:',
    ...((topology.high_fan_in || []).slice(0, 5).map((item) => `- ${md(item.path)} (fan-in ${item.fan_in}, fan-out ${item.fan_out})`)),
    '',
    'High fan-out:',
    ...((topology.high_fan_out || []).slice(0, 5).map((item) => `- ${md(item.path)} (fan-in ${item.fan_in}, fan-out ${item.fan_out})`)),
    '',
    'Limits: static JS/TS import and section guidance only; not a runtime call graph.',
  ];
  return truncate(lines.join('\n'), maxChars);
}

function projectCodeMapFromTopology(root, topologyResult, maxChars = 2500) {
  if (!topologyResult || !topologyResult.topology) return '(none)';
  const artifacts = {
    graph: path.relative(root, topologyResult.out),
    review_focus: path.relative(root, topologyResult.markdown_out),
    telemetry: path.relative(root, topologyResult.telemetry_path),
  };
  const summary = projectCodeMapSummary(topologyResult.topology, artifacts, { maxHotspots: 5 });
  topologyResult.code_map_history = attachCodeMapHistory(root, summary, historyPathForTopologyOut(topologyResult.out));
  return truncate([
    `Artifact: ${artifacts.graph}`,
    '',
    firstLines(renderProjectCodeMap(summary).replace(/^# Forgeflow Project Code Map\s*/u, '').trim(), 80),
  ].join('\n'), maxChars);
}

function truncate(text, maxChars) {
  if (!Number.isFinite(maxChars) || maxChars <= 0 || text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 80)).trimEnd()}\n\n[truncated to ${maxChars} chars]`;
}

function writeTempFile(dir, name, lines) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, `${lines.join('\n')}\n`);
  return file;
}

function buildTopologyContext(root, outDir, files) {
  const sourceFiles = files.filter((file) => /\.(js|jsx|ts|tsx)$/i.test(file));
  if (sourceFiles.length === 0) return null;
  try {
    const filesPath = writeTempFile(outDir, 'topology-files.txt', sourceFiles);
    return buildCodeTopology({
      root,
      filesPath,
      out: path.join(outDir, 'code-topology.json'),
      markdownOut: path.join(outDir, 'code-topology-review-focus.md'),
      telemetryOut: path.join(outDir, 'code-topology-telemetry.json'),
      maxHotspots: 8,
      compact: true,
      source: 'build-context-pack',
    });
  } catch (_err) {
    return null;
  }
}

function compactTopology(topologyResult) {
  if (!topologyResult || !topologyResult.topology) return '(none)';
  const topology = topologyResult.topology;
  const provenance = topology.provenance || {};
  const lines = [
    `Summary: ${topology.summary.source_files} source files, ${topology.summary.local_edges} local edges, ${topology.summary.sections || 0} sections, ${topology.summary.changed_sections || 0} changed sections, ${topology.summary.unresolved_imports} unresolved, ${topology.summary.skipped_dynamic_imports} skipped dynamic.`,
    `Provenance: ${provenance.git_available ? `${provenance.branch}@${provenance.commit_short}${provenance.dirty ? ' dirty' : ' clean'}` : 'git unavailable'}.`,
    '',
    'High fan-in:',
    ...(topology.high_fan_in.length > 0
      ? topology.high_fan_in.slice(0, 5).map((item) => `- ${md(item.path)} (fan-in ${item.fan_in}, fan-out ${item.fan_out})`)
      : ['(none)']),
    '',
    'High fan-out:',
    ...(topology.high_fan_out.length > 0
      ? topology.high_fan_out.slice(0, 5).map((item) => `- ${md(item.path)} (fan-in ${item.fan_in}, fan-out ${item.fan_out})`)
      : ['(none)']),
    '',
    'Changed-file neighbors:',
  ];
  if (topology.changed_file_neighbors.length === 0) {
    lines.push('(none)');
  } else {
    for (const item of topology.changed_file_neighbors.slice(0, 5)) {
      const readNext = item.read_next.map((next) => md(next.path)).slice(0, 5).join(', ') || '(none)';
      lines.push(`- ${md(item.path)}: ${readNext}`);
      if (item.sections && item.sections.length > 0) {
        lines.push(`  - sections: ${item.sections.slice(0, 5).map((section) => `${md(section.name)}:${section.line}-${section.end_line}`).join(', ')}`);
      }
      if (item.changed_sections && item.changed_sections.length > 0) {
        lines.push(`  - changed sections: ${item.changed_sections.slice(0, 5).map((section) => `${md(section.name)}:${section.line}-${section.end_line} changed ${section.changed_lines.join('/')}`).join(', ')}`);
      }
    }
  }
  lines.push('', 'Limits: static JS/TS import graph only; not a runtime call graph.');
  return lines.join('\n');
}

function topologyReport(topologyResult, root) {
  if (!topologyResult || !topologyResult.topology) {
    return {
      available: false,
      reason: 'no-js-ts-files',
    };
  }
  const topology = topologyResult.topology;
  return {
    available: true,
    provenance: topology.provenance || null,
    history: topologyResult.code_map_history || null,
    summary: topology.summary,
    high_fan_in: topology.high_fan_in.slice(0, 5),
    high_fan_out: topology.high_fan_out.slice(0, 5),
    changed_file_neighbors: topology.changed_file_neighbors.slice(0, 5).map((item) => ({
      path: item.path,
      fan_in: item.fan_in,
      fan_out: item.fan_out,
      sections: (item.sections || []).slice(0, 10),
      changed_sections: (item.changed_sections || []).slice(0, 10),
      read_next: item.read_next.slice(0, 5),
    })),
    markdown_sections: (topology.markdown_sections || []).slice(0, 5).map((item) => ({
      path: item.path,
      sections: item.sections.slice(0, 10),
    })),
    paths: {
      graph: path.relative(root, topologyResult.out),
      review_focus: path.relative(root, topologyResult.markdown_out),
      telemetry: path.relative(root, topologyResult.telemetry_path),
    },
    limits: 'static JS/TS import graph only; not a runtime call graph',
  };
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

function packetMarkdown(agent, route, manifest, diffSummary, memoryHits, latestInsights, projectCodeMap, topologySummary, task) {
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
    ...relevant.map((file) => `- ${md(file.path)} (${file.kind}, ${file.exists ? `${file.size_bytes} bytes` : 'missing'})`),
    '',
    '## Local Rule Pack',
    ...rules.map((rule) => `- ${rule}`),
    '',
    '## Memory Hits',
    memoryHits.replace(/^# Memory Hits\s*/u, '').trim() || '(none)',
    '',
    '## Latest Insights',
    latestInsights.replace(/^# Forgeflow Project Learnings[^\n]*\s*/u, '').trim() || '(none)',
    '',
    '## Project Code Map',
    projectCodeMap,
    '',
    '## Code Topology',
    topologySummary,
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

function rawChangedFileChars(root, files) {
  return sum(files.map((file) => fileChars(path.join(root, file))));
}

function rawMemoryChars(root) {
  return sum(memoryFiles(root).map((file) => fileChars(file)));
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
  const memoryIndexPath = ensureMemoryIndex(root, opts.memoryIndex !== false);
  const memoryHits = buildMemoryHits(root, route.files, route, opts.task, opts.maxMemoryChars, memoryIndexPath);
  const topologyContext = buildTopologyContext(root, outDir, route.files);
  const latestInsightsResult = buildLatestInsightsResult(root, 3000, { codeMap: topologyContext ? topologyContext.topology : undefined });
  const latestInsights = latestInsightsResult.markdown;
  const projectCodeMap = projectCodeMapFromTopology(root, topologyContext);
  const projectCodeMapPath = path.join(outDir, 'project-code-map.md');
  const topologySummary = compactTopology(topologyContext);
  const topology = topologyReport(topologyContext, root);
  const agents = route.agents.included || [];
  const packets = {};

  for (const agent of agents) {
    const content = packetMarkdown(agent, route, manifest, diffSummary, memoryHits, latestInsights, projectCodeMap, topologySummary, opts.task);
    const file = path.join(packetDir, `${agent}.md`);
    fs.writeFileSync(file, content);
    packets[agent] = path.relative(root, file);
  }

  const packetFiles = Object.values(packets).map((file) => path.join(root, file));
  const baselinePerAgentChars = rawChangedFileChars(root, route.files) + rawMemoryChars(root) + textChars(diffSummary);
  const telemetry = contextTelemetry('context-pack', {
    baseline_chars: baselinePerAgentChars * Math.max(agents.length, 1),
    compact_chars: sum(packetFiles.map((file) => fileChars(file))),
    detail: {
      agents: agents.length,
      files: route.files.length,
      raw_changed_file_chars: rawChangedFileChars(root, route.files),
      raw_memory_chars: rawMemoryChars(root),
      diff_summary_chars: textChars(diffSummary),
      packet_chars: sum(packetFiles.map((file) => fileChars(file))),
      memory_index_used: Boolean(memoryIndexPath),
    },
  });

  const synthesisInput = {
    schema_version: '1',
    generated_at: new Date().toISOString(),
    repo_root: root,
    route_path: path.relative(root, path.join(outDir, 'route.json')),
    diff_summary_path: path.relative(root, path.join(outDir, 'diff-summary.md')),
    memory_hits_path: path.relative(root, path.join(outDir, 'memory-hits.md')),
    latest_insights_path: path.relative(root, path.join(outDir, 'latest-insights.md')),
    latest_insights_report_path: path.relative(root, path.join(outDir, 'latest-insights-report.json')),
    project_code_map_path: topologyContext ? path.relative(root, projectCodeMapPath) : null,
    project_code_topology_path: topologyContext ? path.relative(root, topologyContext.out) : null,
    code_topology_path: topologyContext ? path.relative(root, topologyContext.out) : null,
    code_topology_review_focus_path: topologyContext ? path.relative(root, topologyContext.markdown_out) : null,
    code_topology_telemetry_path: topologyContext ? path.relative(root, topologyContext.telemetry_path) : null,
    code_topology_provenance: topologyContext && topologyContext.topology ? topologyContext.topology.provenance || null : null,
    code_topology_history: topologyContext ? topologyContext.code_map_history || null : null,
    code_topology_summary: topology,
    memory_index_path: memoryIndexPath ? path.relative(root, memoryIndexPath) : null,
    context_telemetry_path: path.relative(root, path.join(outDir, 'context-telemetry.json')),
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
  fs.writeFileSync(path.join(outDir, 'latest-insights.md'), `${latestInsights || '# Latest Insights\n\n(none)'}\n`);
  fs.writeFileSync(projectCodeMapPath, `# Project Code Map\n\n${projectCodeMap}\n`);
  writeJson(path.join(outDir, 'latest-insights-report.json'), latestInsightsResult.report);
  writeTelemetry(path.join(outDir, 'context-telemetry.json'), telemetry);
  writeJson(path.join(outDir, 'synthesis-input.json'), synthesisInput);

  return {
    out_dir: outDir,
    route,
    manifest,
    synthesis_input: synthesisInput,
    telemetry,
    topology,
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
      estimated_saved_tokens: result.telemetry.estimated_saved_tokens,
      code_topology: result.topology,
    }, null, 2));
  } else {
    console.log(`Context pack: ${result.out_dir}`);
    console.log(`Route: ${result.route.mode}`);
    console.log(`Agent packets: ${Object.keys(result.synthesis_input.agent_packets).join(', ') || 'none'}`);
    if (result.topology.available) {
      console.log(`Code topology: ${result.topology.paths.review_focus}`);
    }
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
  buildLatestInsights,
  buildLatestInsightsResult,
  buildMemoryHits,
  compactProjectCodeMap,
  currentGitState,
  projectCodeMapFromTopology,
  fileKind,
  rulePack,
};
