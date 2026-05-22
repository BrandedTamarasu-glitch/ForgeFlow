#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { compareCodeMapTrend } = require('./show-code-map');

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
    /\b(?:https?|ssh|git):\/\/[^\s)]+/i,
    /\bgit@[^:\s]+:[^\s)]+/i,
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
  if (!text || containsSensitiveContent(text) || isNonGuidanceText(text)) return '';
  return text;
}

function isNonGuidanceText(value) {
  const text = cleanText(value).toLowerCase();
  return [
    /^none\.?$/,
    /^none\b/,
    /^n\/a\.?$/,
    /^not applicable\.?$/,
    /^no (spec gaps?|deviations?|follow-?ups?|issues?|risks?)\.?$/,
  ].some((pattern) => pattern.test(text));
}

function addUnique(list, value) {
  const text = safeText(value);
  if (!text || list.includes(text)) return;
  list.push(text);
}

function evidenceCount(entry) {
  const raw = String(entry && entry.evidence_count ? entry.evidence_count : 1).trim();
  if (!/^\d+$/.test(raw)) return 1;
  const count = Number.parseInt(raw, 10);
  return Number.isInteger(count) && count > 0 ? count : 1;
}

function confidence(entry) {
  const value = cleanText(entry && entry.confidence ? entry.confidence : 'medium').toLowerCase();
  return ['low', 'medium', 'high'].includes(value) ? value : 'medium';
}

function applicationGuidance(entry) {
  return safeText(entry && entry.application_guidance ? entry.application_guidance : '');
}

function candidateStatus(entry) {
  const value = cleanText(entry && entry.status ? entry.status : 'active').toLowerCase();
  return ['active', 'stale', 'superseded'].includes(value) ? value : 'invalid';
}

function activeLearningCandidates(candidates) {
  return (Array.isArray(candidates) ? candidates : []).filter((entry) => candidateStatus(entry) === 'active');
}

function inactiveLearningSummary(candidates, maxItems = 5) {
  return (Array.isArray(candidates) ? candidates : [])
    .filter((entry) => ['stale', 'superseded', 'invalid'].includes(candidateStatus(entry)))
    .slice(0, maxItems)
    .map((entry) => ({
      status: candidateStatus(entry),
      learning: safeText(entry && entry.learning),
      superseded_by: safeText(entry && entry.superseded_by),
    }))
    .filter((entry) => entry.learning);
}

function weightedLearning(entry) {
  const text = safeText(entry && entry.learning);
  if (!text) return '';
  const guidance = applicationGuidance(entry);
  const suffix = [`confidence: ${confidence(entry)}`, `evidence: ${evidenceCount(entry)}`];
  if (guidance) suffix.push(`apply: ${guidance}`);
  return `${text} [${suffix.join(', ')}]`;
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

function codeMapHotspotPath(entry) {
  if (!entry || typeof entry !== 'object') return '';
  return safeText(entry.path || entry.file || '');
}

function codeMapChangedSectionFiles(codeMap) {
  if (!codeMap || typeof codeMap !== 'object') return [];
  if (codeMap.changed_sections && typeof codeMap.changed_sections === 'object' && !Array.isArray(codeMap.changed_sections)) {
    return Object.keys(codeMap.changed_sections).filter(Boolean);
  }
  return [];
}

function latestCodeMapTrend(history) {
  const records = Array.isArray(history) ? history.filter((item) => item && item.summary) : [];
  if (records.length < 2) return { status: records.length === 1 ? 'first-run' : 'missing' };
  return compareCodeMapTrend(records[records.length - 1], records.slice(0, -1));
}

function applyCodeMapTrend(hotFiles, classCounts, recommended, trend) {
  if (!trend || trend.status !== 'compared') return;
  for (const file of trend.new_high_fan_in || []) {
    increment(hotFiles, file);
  }
  for (const file of trend.new_high_fan_out || []) {
    increment(hotFiles, file);
  }
  if (trend.unresolved_imports_delta > 0) {
    increment(classCounts, 'unresolved-import-growth', trend.unresolved_imports_delta);
    addUnique(recommended, `Investigate ${trend.unresolved_imports_delta} new unresolved import(s) before relying on topology guidance.`);
  }
  if (trend.changed_sections_delta > 0) {
    addUnique(recommended, `Prioritize ${trend.changed_sections_delta} additional changed section(s) before broad file reads.`);
  }
}

function buildRollup(inputs = {}, opts = {}) {
  const maxItems = Number.isFinite(opts.maxItems) && opts.maxItems > 0 ? opts.maxItems : DEFAULT_MAX_ITEMS;
  const notes = inputs.notes || {};
  const reviewOutcomes = Array.isArray(inputs.reviewOutcomes) ? inputs.reviewOutcomes : [];
  const allLearningCandidates = Array.isArray(inputs.learningCandidates) ? inputs.learningCandidates : [];
  const learningCandidates = activeLearningCandidates(allLearningCandidates);
  const shipSummary = inputs.shipSummary || {};
  const codeMap = inputs.codeMap || null;
  const codeMapHistory = Array.isArray(inputs.codeMapHistory) ? inputs.codeMapHistory : [];
  const codeMapTrend = inputs.codeMapTrend || latestCodeMapTrend(codeMapHistory);
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
    if (candidate.category === 'risk-area') increment(classCounts, candidate.learning, evidenceCount(candidate));
    if (candidate.category === 'hot-file') increment(hotFiles, candidate.learning, evidenceCount(candidate));
  }
  if (codeMap && codeMap.summary) {
    for (const item of Array.isArray(codeMap.high_fan_in) ? codeMap.high_fan_in : []) increment(hotFiles, codeMapHotspotPath(item));
    for (const item of Array.isArray(codeMap.high_fan_out) ? codeMap.high_fan_out : []) increment(hotFiles, codeMapHotspotPath(item));
    for (const file of codeMapChangedSectionFiles(codeMap)) increment(hotFiles, file);
  }
  applyCodeMapTrend(hotFiles, classCounts, recommended, codeMapTrend);

  const recurringPitfalls = [];
  for (const note of notes.spec_gaps || []) addUnique(recurringPitfalls, note);
  for (const note of notes.deviations || []) addUnique(recurringPitfalls, note);
  for (const candidate of learningCandidates.filter((item) => item.category === 'recurring-pitfall')) {
    addUnique(recurringPitfalls, weightedLearning(candidate));
  }
  for (const item of topCounts(classCounts, maxItems)) addUnique(recurringPitfalls, `${item.name} findings recurred ${item.count} time(s).`);

  const stableDecisions = [];
  for (const note of notes.decisions || []) addUnique(stableDecisions, note);
  for (const note of notes.tradeoffs || []) addUnique(stableDecisions, note);
  for (const candidate of learningCandidates.filter((item) => item.category === 'stable-decision')) {
    addUnique(stableDecisions, weightedLearning(candidate));
  }

  const validationPatterns = [];
  for (const note of notes.validation_notes || []) addUnique(validationPatterns, note);
  for (const candidate of learningCandidates.filter((item) => item.category === 'validation-pattern')) {
    addUnique(validationPatterns, weightedLearning(candidate));
  }

  const repeatedFollowUps = [];
  for (const note of notes.follow_ups || []) addUnique(repeatedFollowUps, note);
  for (const candidate of learningCandidates.filter((item) => item.category === 'repeated-follow-up')) {
    addUnique(repeatedFollowUps, weightedLearning(candidate));
  }

  const hotFileItems = topCounts(hotFiles, maxItems).map((item) => item.count > 1 ? `${item.name} (${item.count} signals)` : item.name);
  const topRisk = topCounts(classCounts, 1)[0];
  const topFile = hotFileItems[0];
  if (topRisk) addUnique(recommended, `Check ${topRisk.name} risks early; review outcomes have repeated this category.`);
  if (topFile) addUnique(recommended, `Inspect ${topFile.replace(/\s+\(\d+ signals\)$/, '')} first when it is in scope.`);
  if (codeMap && codeMap.summary && codeMap.summary.changed_sections > 0) {
    addUnique(recommended, `Start with ${codeMap.summary.changed_sections} changed code-map section(s) before broad file reads.`);
  }
  if (validationPatterns.length > 0) addUnique(recommended, 'Reuse the recorded validation pattern before ship.');
  if (repeatedFollowUps.length > 0) addUnique(recommended, 'Resolve repeated follow-ups before expanding scope.');
  for (const candidate of learningCandidates.filter((item) => item.category === 'recommended-approach')) {
    addUnique(recommended, weightedLearning(candidate));
  }
  if (recommended.length === 0) addUnique(recommended, 'Run a few more work items, then refresh this rollup with new notes and review outcomes.');

  return {
    schema_version: '1',
    generated_at: opts.generatedAt || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    sources: {
      implementation_notes: Boolean(inputs.hasImplementationNotes),
      learning_candidates: allLearningCandidates.length,
      learning_candidates_active: learningCandidates.length,
      learning_candidates_inactive: allLearningCandidates.filter((entry) => ['stale', 'superseded'].includes(candidateStatus(entry))).length,
      learning_candidates_invalid: allLearningCandidates.filter((entry) => candidateStatus(entry) === 'invalid').length,
      learning_candidates_inactive_examples: inactiveLearningSummary(allLearningCandidates),
      review_outcomes: reviewOutcomes.length,
      ship_summary: Boolean(inputs.hasShipSummary),
      code_map: Boolean(inputs.hasCodeMap),
      code_map_sections: codeMap && codeMap.summary ? codeMap.summary.sections || 0 : 0,
      code_map_changed_sections: codeMap && codeMap.summary ? codeMap.summary.changed_sections || 0 : 0,
      code_map_history: codeMapHistory.length,
      code_map_trend: codeMapTrend.status || 'missing',
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
    `- Generated at: ${rollup.generated_at || 'unknown'}`,
    `- Implementation notes: ${rollup.sources.implementation_notes ? 'present' : 'missing'}`,
    `- Learning candidates: ${rollup.sources.learning_candidates_active || 0} active, ${rollup.sources.learning_candidates_inactive || 0} inactive, ${rollup.sources.learning_candidates_invalid || 0} invalid`,
    ...(Array.isArray(rollup.sources.learning_candidates_inactive_examples) && rollup.sources.learning_candidates_inactive_examples.length > 0
      ? rollup.sources.learning_candidates_inactive_examples.map((entry) => `  - ${entry.status}: ${entry.learning}${entry.superseded_by ? ` (replace with: ${entry.superseded_by})` : ''}`)
      : []),
    `- Review outcomes: ${rollup.sources.review_outcomes}`,
    `- Ship summary: ${rollup.sources.ship_summary ? 'present' : 'missing'}`,
    `- Code map: ${rollup.sources.code_map ? `${rollup.sources.code_map_sections} sections, ${rollup.sources.code_map_changed_sections} changed` : 'missing'}`,
    `- Code map history: ${rollup.sources.code_map_history} snapshot(s), trend ${rollup.sources.code_map_trend}`,
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
  const codeMapPath = path.join(projectDir, 'context', 'code-topology.json');
  const codeMapHistoryPath = path.join(projectDir, 'context', 'code-map-history.jsonl');
  const codeMap = Object.prototype.hasOwnProperty.call(opts, 'codeMap') ? opts.codeMap : readJson(codeMapPath);
  const codeMapHistory = Object.prototype.hasOwnProperty.call(opts, 'codeMapHistory') ? opts.codeMapHistory : readJsonl(codeMapHistoryPath);
  const inputs = {
    notes: readImplementationNotes(projectDir),
    reviewOutcomes: readJsonl(reviewOutcomesPath),
    learningCandidates: readJsonl(learningCandidatesPath),
    shipSummary: readJson(shipSummaryPath) || {},
    codeMap,
    codeMapHistory,
    hasImplementationNotes: fs.existsSync(implementationNotesPath),
    hasShipSummary: fs.existsSync(shipSummaryPath),
    hasCodeMap: Boolean(codeMap && codeMap.summary),
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
  activeLearningCandidates,
  candidateStatus,
  inactiveLearningSummary,
  containsSensitiveContent,
  parseImplementationNotes,
  renderMarkdown,
  rollupProjectLearnings,
};
