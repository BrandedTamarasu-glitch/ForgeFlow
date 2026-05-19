#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DEFAULT_MAX_ITEMS = 8;

function usage() {
  console.error('Usage: rollup-project-learnings.js [--project-dir <dir>] [--out <path>] [--max-items <n>] [--json]');
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
    projectDir: '',
    out: '',
    maxItems: DEFAULT_MAX_ITEMS,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--out') {
      opts.out = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--max-items') {
      opts.maxItems = Number.parseInt(requireValue(argv, arg, i), 10);
      i += 1;
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

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function defaultOut(projectDir) {
  return path.join(projectDir, 'project-learnings.md');
}

function containsSensitiveContent(value) {
  return [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
    /\b(api[_-]?key|password|passwd|secret|token)\s*[:=]/i,
    /\b[A-Z0-9]{20,}\b/,
    /https?:\/\/[^\s)]+/i,
  ].some((pattern) => pattern.test(String(value || '')));
}

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[|]/g, '/')
    .trim();
}

function safeText(value) {
  const text = cleanText(value);
  if (!text || containsSensitiveContent(text)) return '';
  return text;
}

function addUnique(list, value) {
  const text = safeText(value);
  if (!text || list.includes(text)) return;
  list.push(text);
}

function increment(map, key, amount = 1) {
  const normalized = cleanText(key).toLowerCase();
  if (!normalized) return;
  map[normalized] = (map[normalized] || 0) + amount;
}

function topCounts(map, maxItems) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxItems)
    .map(([name, count]) => ({ name, count }));
}

function parseImplementationNotes(content) {
  const sections = {
    decisions: [],
    spec_gaps: [],
    tradeoffs: [],
    deviations: [],
    follow_ups: [],
    validation_notes: [],
  };
  const headings = {
    decisions: 'decisions',
    'spec gaps': 'spec_gaps',
    tradeoffs: 'tradeoffs',
    deviations: 'deviations',
    'follow-ups': 'follow_ups',
    'follow ups': 'follow_ups',
    'validation notes': 'validation_notes',
  };
  let current = '';
  for (const raw of String(content || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('## ')) {
      current = headings[line.slice(3).trim().toLowerCase()] || '';
      continue;
    }
    if (!current || !line.startsWith('- ')) continue;
    let text = line.slice(2).trim();
    const parts = text.split('|').map((part) => part.trim());
    if (parts.length >= 4) text = parts.slice(3).join(' | ');
    text = text.replace(/\s+Why:\s+/g, ' - ');
    addUnique(sections[current], text);
  }
  return sections;
}

function readImplementationNotes(projectDir) {
  const file = path.join(projectDir, 'implementation-notes.md');
  if (!fs.existsSync(file)) return parseImplementationNotes('');
  return parseImplementationNotes(fs.readFileSync(file, 'utf8'));
}

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_err) {
    return null;
  }
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (_err) {
        return null;
      }
    })
    .filter(Boolean);
}

function filePathFromEntry(entry) {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object') return entry.path || entry.file || '';
  return '';
}

function buildRollup(inputs = {}, opts = {}) {
  const maxItems = Number.isFinite(opts.maxItems) && opts.maxItems > 0 ? opts.maxItems : DEFAULT_MAX_ITEMS;
  const notes = inputs.notes || {};
  const reviewOutcomes = Array.isArray(inputs.reviewOutcomes) ? inputs.reviewOutcomes : [];
  const learningCandidates = Array.isArray(inputs.learningCandidates) ? inputs.learningCandidates : [];
  const shipSummary = inputs.shipSummary || {};
  const classCounts = {};
  const hotFiles = {};
  const reviewModes = {};
  const recommended = [];

  for (const outcomeRecord of reviewOutcomes) {
    const review = outcomeRecord.review || {};
    const outcome = outcomeRecord.outcome || {};
    increment(reviewModes, review.mode);
    for (const findingClass of Array.isArray(outcome.finding_classes) ? outcome.finding_classes : []) {
      const total = Number.isInteger(findingClass.confirmed) ? findingClass.confirmed : findingClass.total;
      increment(classCounts, findingClass.class, Number.isFinite(total) && total > 0 ? total : 1);
    }
    if (outcome.post_merge_regression) {
      increment(classCounts, 'post-merge-regression');
    }
    if (outcome.auto_fix_success === false) {
      increment(classCounts, 'auto-fix-failed');
    }
  }

  for (const entry of Array.isArray(shipSummary.files) ? shipSummary.files : []) {
    increment(hotFiles, filePathFromEntry(entry));
  }
  for (const candidate of learningCandidates) {
    if (candidate.category === 'risk-area') increment(classCounts, candidate.learning);
    if (candidate.category === 'hot-file') increment(hotFiles, candidate.learning);
  }

  const recurringPitfalls = [];
  for (const note of notes.spec_gaps || []) addUnique(recurringPitfalls, note);
  for (const note of notes.deviations || []) addUnique(recurringPitfalls, note);
  for (const candidate of learningCandidates.filter((item) => item.category === 'recurring-pitfall')) {
    addUnique(recurringPitfalls, candidate.learning);
  }
  for (const item of topCounts(classCounts, maxItems)) addUnique(recurringPitfalls, `${item.name} findings recurred ${item.count} time(s).`);

  const stableDecisions = [];
  for (const note of notes.decisions || []) addUnique(stableDecisions, note);
  for (const note of notes.tradeoffs || []) addUnique(stableDecisions, note);
  for (const candidate of learningCandidates.filter((item) => item.category === 'stable-decision')) {
    addUnique(stableDecisions, candidate.learning);
  }

  const validationPatterns = [];
  for (const note of notes.validation_notes || []) addUnique(validationPatterns, note);
  for (const candidate of learningCandidates.filter((item) => item.category === 'validation-pattern')) {
    addUnique(validationPatterns, candidate.learning);
  }

  const repeatedFollowUps = [];
  for (const note of notes.follow_ups || []) addUnique(repeatedFollowUps, note);
  for (const candidate of learningCandidates.filter((item) => item.category === 'repeated-follow-up')) {
    addUnique(repeatedFollowUps, candidate.learning);
  }

  const hotFileItems = topCounts(hotFiles, maxItems).map((item) => item.count > 1 ? `${item.name} (${item.count} changes)` : item.name);
  const topRisk = topCounts(classCounts, 1)[0];
  const topFile = hotFileItems[0];
  if (topRisk) addUnique(recommended, `Check ${topRisk.name} risks early; review outcomes have repeated this category.`);
  if (topFile) addUnique(recommended, `Inspect ${topFile.replace(/\s+\(\d+ changes\)$/, '')} first when it is in scope.`);
  if (validationPatterns.length > 0) addUnique(recommended, 'Reuse the recorded validation pattern before ship.');
  if (repeatedFollowUps.length > 0) addUnique(recommended, 'Resolve repeated follow-ups before expanding scope.');
  for (const candidate of learningCandidates.filter((item) => item.category === 'recommended-approach')) {
    addUnique(recommended, candidate.learning);
  }
  if (recommended.length === 0) addUnique(recommended, 'Run a few more work items, then refresh this rollup with new notes and review outcomes.');

  return {
    schema_version: '1',
    sources: {
      implementation_notes: Boolean(inputs.hasImplementationNotes),
      learning_candidates: learningCandidates.length,
      review_outcomes: reviewOutcomes.length,
      ship_summary: Boolean(inputs.hasShipSummary),
    },
    recurring_pitfalls: recurringPitfalls.slice(0, maxItems),
    stable_decisions: stableDecisions.slice(0, maxItems),
    risk_areas: topCounts(classCounts, maxItems),
    validation_patterns: validationPatterns.slice(0, maxItems),
    hot_files_and_modules: hotFileItems,
    repeated_follow_ups: repeatedFollowUps.slice(0, maxItems),
    review_modes: topCounts(reviewModes, maxItems),
    recommended_approach_for_next_work: recommended.slice(0, maxItems),
  };
}

function bulletList(items, emptyText = 'No repeated pattern recorded yet.') {
  if (!items || items.length === 0) return [`- ${emptyText}`];
  return items.map((item) => {
    if (typeof item === 'string') return `- ${item}`;
    return `- ${item.name}: ${item.count}`;
  });
}

function renderMarkdown(rollup) {
  const lines = [
    '# Project Learnings',
    '',
    'Durable local guidance generated from Forgeflow implementation notes, review outcomes, and ship metadata.',
    '',
    'Project learnings are guidance only. Verify current findings against current code, tests, and artifacts.',
    '',
    '## Sources',
    '',
    `- Implementation notes: ${rollup.sources.implementation_notes ? 'present' : 'missing'}`,
    `- Learning candidates: ${rollup.sources.learning_candidates}`,
    `- Review outcomes: ${rollup.sources.review_outcomes}`,
    `- Ship summary: ${rollup.sources.ship_summary ? 'present' : 'missing'}`,
    '',
    '## Recurring Pitfalls',
    '',
    ...bulletList(rollup.recurring_pitfalls),
    '',
    '## Stable Decisions',
    '',
    ...bulletList(rollup.stable_decisions),
    '',
    '## Risk Areas',
    '',
    ...bulletList(rollup.risk_areas),
    '',
    '## Validation Patterns',
    '',
    ...bulletList(rollup.validation_patterns),
    '',
    '## Hot Files And Modules',
    '',
    ...bulletList(rollup.hot_files_and_modules),
    '',
    '## Repeated Follow-ups',
    '',
    ...bulletList(rollup.repeated_follow_ups),
    '',
    '## Recommended Approach For Next Work',
    '',
    ...bulletList(rollup.recommended_approach_for_next_work),
  ];
  return `${lines.join('\n')}\n`;
}

function rollupProjectLearnings(opts = {}) {
  const root = repoRoot();
  const projectDir = opts.projectDir || defaultProjectDir(root);
  const out = opts.out || defaultOut(projectDir);
  const implementationNotesPath = path.join(projectDir, 'implementation-notes.md');
  const reviewOutcomesPath = path.join(projectDir, 'review-outcomes.jsonl');
  const learningCandidatesPath = path.join(projectDir, 'project-learning-candidates.jsonl');
  const shipSummaryPath = path.join(projectDir, 'ship', 'ship-summary.json');
  const inputs = {
    notes: readImplementationNotes(projectDir),
    reviewOutcomes: readJsonl(reviewOutcomesPath),
    learningCandidates: readJsonl(learningCandidatesPath),
    shipSummary: readJson(shipSummaryPath) || {},
    hasImplementationNotes: fs.existsSync(implementationNotesPath),
    hasShipSummary: fs.existsSync(shipSummaryPath),
  };
  const rollup = buildRollup(inputs, opts);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, renderMarkdown(rollup), 'utf8');
  return {
    ...rollup,
    project_dir: projectDir,
    out,
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = rollupProjectLearnings(opts);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    console.log(`Project learnings written to ${result.out}`);
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
  buildRollup,
  containsSensitiveContent,
  parseImplementationNotes,
  renderMarkdown,
  rollupProjectLearnings,
};
