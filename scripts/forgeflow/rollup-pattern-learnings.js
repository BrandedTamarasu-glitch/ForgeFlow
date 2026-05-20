#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');

const PERIOD_DAYS = {
  week: 7,
  month: 30,
};
const STOPWORDS = new Set([
  'about', 'after', 'again', 'against', 'before', 'being', 'between', 'could', 'every', 'first',
  'from', 'into', 'needs', 'should', 'that', 'their', 'there', 'these', 'this', 'those', 'through',
  'when', 'where', 'with', 'without', 'would',
]);
const PATTERN_KEYWORDS = [
  {
    pattern: 'Type Safety & Schema Mismatches',
    keywords: ['enum', 'schema', 'type', 'drizzle', 'typescript', 'varchar', 'nullable', 'mismatch', 'signature'],
  },
  {
    pattern: 'Unimplemented / Promised-But-Missing Features',
    keywords: ['not implemented', 'missing', 'promised', 'declared but', 'not wired', 'todo', 'unimplemented'],
  },
  {
    pattern: 'Null-Safety & Error-Path Gaps',
    keywords: ['null', 'nullable', 'undefined', 'unchecked', 'guard', 'assertion', 'throws', 'silent'],
  },
];

function usage() {
  console.error([
    'Usage: rollup-pattern-learnings.js [--root <dir>] [--patterns-dir <dir>]',
    '       [--period week|month|all] [--min-projects N] [--min-occurrences N] [--dry-run] [--json]',
  ].join('\n'));
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) {
    console.error(`Missing value for ${name}`);
    usage();
    process.exit(2);
  }
  return value;
}

function parseArgs(argv) {
  const opts = {
    root: os.homedir(),
    patternsDir: '',
    period: 'all',
    minProjects: 2,
    minOccurrences: 3,
    dryRun: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--patterns-dir') {
      opts.patternsDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--period') {
      opts.period = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--min-projects') {
      opts.minProjects = Number.parseInt(requireValue(argv, arg, i), 10);
      i += 1;
    } else if (arg === '--min-occurrences') {
      opts.minOccurrences = Number.parseInt(requireValue(argv, arg, i), 10);
      i += 1;
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
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
  if (!['week', 'month', 'all'].includes(opts.period)) {
    console.error(`Invalid --period: ${opts.period}`);
    usage();
    process.exit(2);
  }
  if (!Number.isFinite(opts.minProjects) || opts.minProjects < 1) {
    console.error('Invalid --min-projects. Expected positive integer.');
    process.exit(2);
  }
  if (!Number.isFinite(opts.minOccurrences) || opts.minOccurrences < 1) {
    console.error('Invalid --min-occurrences. Expected positive integer.');
    process.exit(2);
  }
  return opts;
}

function defaultPatternsDir(root = process.cwd(), home = os.homedir()) {
  const local = path.join(root, 'forgeflow-patterns');
  return fs.existsSync(local) ? local : path.join(home, '.claude', 'forgeflow-patterns');
}

function cutoffForPeriod(period, now = new Date()) {
  if (period === 'all') return '1970-01-01T00:00:00.000Z';
  return new Date(now.getTime() - PERIOD_DAYS[period] * 86400000).toISOString();
}

function walk(dir, predicate, files = []) {
  if (!dir || !fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walk(file, predicate, files);
    } else if (entry.isFile() && predicate(file)) {
      files.push(file);
    }
  }
  return files;
}

function learningFiles(root) {
  return walk(root, (file) => (
    path.basename(file) === 'learnings.jsonl'
    && file.split(path.sep).includes('.forgeflow')
  )).sort();
}

function candidateFiles(root) {
  return walk(root, (file) => (
    path.basename(file) === 'project-learning-candidates.jsonl'
    && file.split(path.sep).includes('.forgeflow')
  )).sort();
}

function learningSourceFiles(root) {
  return [...learningFiles(root), ...candidateFiles(root)].sort();
}

function projectFromLearningPath(file) {
  const parts = file.split(path.sep);
  const index = parts.lastIndexOf('.forgeflow');
  return index >= 0 && parts[index + 1] ? parts[index + 1] : path.basename(path.dirname(file));
}

function readJsonl(file) {
  const records = [];
  if (!fs.existsSync(file)) return records;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch (_err) {
      // Learning logs are append-only; skip corrupt lines and keep the scan useful.
    }
  }
  return records;
}

function inWindow(record, cutoff) {
  const value = Date.parse(record.date || record.ts || '');
  return !Number.isNaN(value) && value >= Date.parse(cutoff);
}

function normalizeLearning(record, file, cutoff) {
  if (!record || !inWindow(record, cutoff)) return null;
  const learning = String(record.learning || record.summary || record.finding || '').trim();
  if (!learning) return null;
  return {
    project: projectFromLearningPath(file),
    date: String(record.date || record.ts || '').slice(0, 10),
    source: String(record.source || ''),
    type: String(record.type || 'uncategorized'),
    learning,
    files: Array.isArray(record.files) ? record.files : [],
    severity: String(record.severity || 'medium').toLowerCase(),
  };
}

function severityFromConfidence(confidence) {
  const value = String(confidence || '').toLowerCase();
  if (value === 'high') return 'high';
  if (value === 'low') return 'low';
  return 'medium';
}

function normalizeProjectCandidate(record, file, cutoff) {
  if (!record || !inWindow(record, cutoff)) return null;
  const learning = String(record.learning || '').trim();
  if (!learning) return null;
  return {
    project: projectFromLearningPath(file),
    date: String(record.date || record.ts || '').slice(0, 10),
    source: String(record.source || 'Atlas'),
    type: String(record.category || 'project-learning'),
    learning,
    files: [],
    severity: severityFromConfidence(record.confidence),
  };
}

function normalizeRecord(record, file, cutoff) {
  const basename = path.basename(file);
  if (basename === 'project-learning-candidates.jsonl') {
    return normalizeProjectCandidate(record, file, cutoff);
  }
  return normalizeLearning(record, file, cutoff);
}

function readPatternTitles(patternsDir) {
  const file = path.join(patternsDir, 'recurring-blockers.md');
  if (!fs.existsSync(file)) return PATTERN_KEYWORDS.map((item) => item.pattern);
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^##\s+/.test(line) && !/Promotion criteria/i.test(line))
    .map((line) => line.replace(/^##\s+/, '').replace(/^\d+\.\s+/, '').trim())
    .filter(Boolean);
}

function scoreKnownPattern(learning) {
  const text = learning.toLowerCase();
  let best = { pattern: '', score: 0 };
  for (const entry of PATTERN_KEYWORDS) {
    const score = entry.keywords.reduce((sum, keyword) => sum + (text.includes(keyword.toLowerCase()) ? 1 : 0), 0);
    if (score > best.score) best = { pattern: entry.pattern, score };
  }
  return best.score >= 2 ? best.pattern : '';
}

function keywordKey(learning) {
  const words = learning.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOPWORDS.has(word))
    .slice(0, 5);
  return words.join(' ') || 'uncategorized';
}

function maxSeverity(items) {
  const rank = { low: 1, medium: 2, high: 3, critical: 4, blocker: 4 };
  return items.slice().sort((a, b) => (rank[b.severity] || 2) - (rank[a.severity] || 2))[0]?.severity || 'medium';
}

function summarizeKnown(items) {
  const byPattern = new Map();
  for (const item of items) {
    const pattern = scoreKnownPattern(item.learning);
    if (!pattern) continue;
    if (!byPattern.has(pattern)) byPattern.set(pattern, []);
    byPattern.get(pattern).push(item);
  }
  return [...byPattern.entries()].map(([pattern, records]) => ({
    pattern,
    projects: [...new Set(records.map((item) => item.project))].sort(),
    occurrences: records.length,
    sample_learnings: records.slice(0, 5),
    applied: false,
  })).sort((a, b) => b.occurrences - a.occurrences || a.pattern.localeCompare(b.pattern));
}

function summarizeCandidates(items, minProjects, minOccurrences) {
  const clusters = new Map();
  for (const item of items) {
    if (scoreKnownPattern(item.learning)) continue;
    const key = `${item.type}:${keywordKey(item.learning)}`;
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key).push(item);
  }
  return [...clusters.entries()]
    .map(([key, records]) => {
      const projects = [...new Set(records.map((item) => item.project))].sort();
      return {
        title: key.split(':')[1].replace(/\b\w/g, (letter) => letter.toUpperCase()),
        type: key.split(':')[0],
        projects,
        occurrences: records.length,
        max_severity: maxSeverity(records),
        sample_learnings: records.slice(0, 5),
      };
    })
    .filter((item) => item.projects.length >= minProjects && item.occurrences >= minOccurrences)
    .sort((a, b) => b.occurrences - a.occurrences || a.title.localeCompare(b.title));
}

function writeLearningLog(patternsDir, result) {
  fs.mkdirSync(patternsDir, { recursive: true });
  const record = {
    ts: result.generated_at,
    projects_scanned: result.projects_scanned,
    learnings_total: result.learnings_total,
    updates_applied: result.known_pattern_updates.filter((item) => item.applied).length,
    candidates: result.candidates.length,
  };
  fs.appendFileSync(path.join(patternsDir, '.learnings-log.jsonl'), `${JSON.stringify(record)}\n`);
}

function rollupPatternLearnings(opts = {}) {
  const root = opts.root || os.homedir();
  const patternsDir = opts.patternsDir || defaultPatternsDir(process.cwd());
  const now = opts.now || new Date();
  const period = opts.period || 'all';
  const cutoff = opts.cutoff || cutoffForPeriod(period, now);
  const files = opts.files || learningSourceFiles(root);
  const learnings = files.flatMap((file) => readJsonl(file)
    .map((record) => normalizeRecord(record, file, cutoff))
    .filter(Boolean));
  const legacyLearningFiles = files.filter((file) => path.basename(file) === 'learnings.jsonl');
  const projectCandidateFiles = files.filter((file) => path.basename(file) === 'project-learning-candidates.jsonl');
  const projects = [...new Set(learnings.map((item) => item.project))].sort();
  const knownPatternTitles = readPatternTitles(patternsDir);
  const result = {
    schema_version: '1',
    generated_at: now.toISOString(),
    period,
    cutoff,
    dry_run: Boolean(opts.dryRun),
    patterns_dir: patternsDir,
    learning_files: files,
    legacy_learning_files: legacyLearningFiles,
    project_learning_candidate_files: projectCandidateFiles,
    known_patterns: knownPatternTitles,
    projects_scanned: projects.length,
    learnings_total: learnings.length,
    known_pattern_updates: summarizeKnown(learnings),
    candidates: summarizeCandidates(learnings, opts.minProjects || 2, opts.minOccurrences || 3),
    uninstrumented_projects: [],
  };
  if (!opts.dryRun) writeLearningLog(patternsDir, result);
  return result;
}

function renderMarkdown(result) {
  const lines = [
    `# Forgeflow Learnings - ${result.period}`,
    '',
    '## Scan summary',
    '',
    `- Projects scanned: ${result.projects_scanned}`,
    `- Total learnings: ${result.learnings_total}`,
    `- Learning files: ${result.learning_files.length} (${result.legacy_learning_files.length} legacy, ${result.project_learning_candidate_files.length} project candidates)`,
    `- Period cutoff: ${result.cutoff}`,
    `- Mode: ${result.dry_run ? 'dry-run' : 'recorded'}`,
    '',
    `## Known pattern updates ${result.dry_run ? 'dry-run' : 'recorded'}`,
    '',
  ];
  if (result.known_pattern_updates.length === 0) {
    lines.push('- None.');
  } else {
    for (const item of result.known_pattern_updates) {
      lines.push(`- **${item.pattern}** - ${item.occurrences} occurrence(s) across ${item.projects.length} project(s): ${item.projects.join(', ')}`);
    }
  }
  lines.push('', `## Candidates for promotion (${result.candidates.length})`, '');
  if (result.candidates.length === 0) {
    lines.push('- None met the configured thresholds.');
  } else {
    for (const item of result.candidates) {
      lines.push(`### Candidate: ${item.title}`);
      lines.push('');
      lines.push(`Threshold: ${item.projects.length} project(s), ${item.occurrences} occurrence(s), max severity ${item.max_severity}`);
      lines.push('');
      lines.push('**Citations:**');
      for (const sample of item.sample_learnings) {
        lines.push(`- \`${sample.project}\` (${sample.date || 'unknown'}) - "${sample.learning}"`);
      }
      lines.push('');
    }
  }
  return lines.join('\n').trimEnd();
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = rollupPatternLearnings(opts);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderMarkdown(result)}\n`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = {
  cutoffForPeriod,
  candidateFiles,
  learningFiles,
  learningSourceFiles,
  renderMarkdown,
  rollupPatternLearnings,
  scoreKnownPattern,
  summarizeCandidates,
  summarizeKnown,
};
