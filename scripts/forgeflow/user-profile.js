#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { appendFileSafe, assertSafeDirectory, safeReadTextFile, writeFileSafe } = require('./file-safety');
const { containsSensitiveContent, sensitiveIssues: privacySensitiveIssues } = require('./privacy-boundary');

const VALID_SCOPES = new Set(['global', 'project']);
const VALID_CATEGORIES = new Set([
  'communication',
  'autonomy',
  'risk',
  'validation',
  'release',
  'docs',
  'review',
  'workflow',
  'ui',
  'product-copy',
  'accessibility',
]);
const VALID_CONFIDENCE = new Set(['low', 'medium', 'high']);
const VALID_STATUS = new Set(['active', 'stale', 'superseded']);
const VALID_SOURCES = new Set([
  'explicit-user-instruction',
  'repeated-user-behavior',
  'user-correction',
  'accepted-workflow',
  'inferred',
]);
const VALID_APPLIES_TO = new Set([
  'discuss',
  'research',
  'plan',
  'consult',
  'implement',
  'review',
  'ship',
  'support',
  'release',
  'docs',
  'ui',
  'next-step',
  'handoff',
]);
const OPERATING_CATEGORIES = new Set(['communication', 'autonomy', 'risk', 'validation', 'release', 'docs', 'review', 'workflow']);
const EXPERIENCE_CATEGORIES = new Set(['ui', 'product-copy', 'accessibility']);

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

function defaultHome() {
  return path.join(os.homedir(), '.claude');
}

function globalProfileFile(home = defaultHome()) {
  return path.join(home, 'forgeflow', 'user-operating-profile.jsonl');
}

function projectProfileFile(projectDir) {
  return path.join(projectDir, 'project-experience-profile.jsonl');
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').replace(/[|]/g, '/').trim();
}

function cleanList(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  return String(value || '')
    .split(',')
    .map(cleanText)
    .filter(Boolean);
}

function normalizeEnum(value, valid, fallback, label) {
  const normalized = cleanText(value || fallback).toLowerCase();
  if (!valid.has(normalized)) throw new Error(`Invalid user profile ${label}`);
  return normalized;
}

function normalizeEvidenceCount(value) {
  if (value === undefined || value === null || value === '') return 1;
  const raw = String(value).trim();
  const count = Number.parseInt(raw, 10);
  if (!/^\d+$/.test(raw) || !Number.isInteger(count) || count < 1) {
    throw new Error('User profile evidence_count must be a positive integer');
  }
  return count;
}

function normalizeAppliesTo(value) {
  const items = cleanList(value);
  if (items.length === 0) return ['implement', 'review'];
  for (const item of items) {
    if (!VALID_APPLIES_TO.has(item)) throw new Error('Invalid user profile applies_to value');
  }
  return [...new Set(items)];
}

function boundedText(value, label, max = 280) {
  const text = cleanText(value);
  if (text.length > max) throw new Error(`User profile ${label} must be ${max} characters or fewer`);
  return text;
}

function normalizeEntry(entry = {}) {
  if (entry.schema_version && cleanText(entry.schema_version) !== '1') {
    throw new Error('Unsupported user profile schema_version');
  }
  const scope = normalizeEnum(entry.scope, VALID_SCOPES, 'global', 'scope');
  const category = normalizeEnum(entry.category, VALID_CATEGORIES, '', 'category');
  const normalized = {
    schema_version: '1',
    ts: cleanText(entry.ts || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')),
    scope,
    category,
    preference: boundedText(entry.preference, 'preference'),
    evidence: boundedText(entry.evidence || '', 'evidence'),
    confidence: normalizeEnum(entry.confidence, VALID_CONFIDENCE, 'medium', 'confidence'),
    evidence_count: normalizeEvidenceCount(entry.evidence_count ?? entry.evidenceCount),
    status: normalizeEnum(entry.status, VALID_STATUS, 'active', 'status'),
    source: normalizeEnum(entry.source, VALID_SOURCES, 'explicit-user-instruction', 'source'),
    applies_to: normalizeAppliesTo(entry.applies_to ?? entry.appliesTo),
    agent_guidance: boundedText(entry.agent_guidance ?? entry.agentGuidance ?? entry.preference, 'agent_guidance'),
    superseded_by: boundedText(entry.superseded_by ?? entry.supersededBy ?? '', 'superseded_by'),
  };
  if (!normalized.preference) throw new Error('User profile preference is required');
  if (normalized.status === 'superseded' && !normalized.superseded_by) {
    throw new Error('Superseded user profile preference requires superseded_by');
  }
  const combined = [
    normalized.scope,
    normalized.category,
    normalized.preference,
    normalized.evidence,
    normalized.agent_guidance,
    normalized.superseded_by,
  ].join('\n');
  if (containsSensitiveContent(combined)) {
    throw new Error('User profile entry appears to contain sensitive content');
  }
  return normalized;
}

function profileFiles(opts = {}) {
  const root = opts.root ? repoRoot(opts.root) : repoRoot();
  const projectDir = opts.projectDir || defaultProjectDir(root);
  const home = opts.home || defaultHome();
  return {
    root,
    projectDir,
    home,
    global: opts.globalFile || globalProfileFile(home),
    project: opts.projectFile || projectProfileFile(projectDir),
  };
}

function targetFileForEntry(entry, opts = {}) {
  const files = profileFiles(opts);
  return entry.scope === 'project' ? files.project : files.global;
}

function recordUserProfile(opts = {}) {
  const entry = normalizeEntry(opts.entry || opts);
  const file = targetFileForEntry(entry, opts);
  appendFileSafe(file, `${JSON.stringify(entry)}\n`);
  return { file, entry };
}

function readJsonl(file, baseDir) {
  if (!file || !fs.existsSync(file)) return { records: [], issues: [] };
  const records = [];
  const issues = [];
  let content = '';
  try {
    content = safeReadTextFile(file, baseDir).content;
  } catch (err) {
    return {
      records,
      issues: [{ severity: 'fail', code: 'profile-file-unsafe', message: err.message, source: file }],
    };
  }
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const value = JSON.parse(line);
      const normalized = normalizeEntry(value);
      records.push({ line: i + 1, value: normalized });
    } catch (err) {
      issues.push({ severity: 'fail', code: 'profile-entry-invalid', message: err.message, source: file, line: i + 1 });
    }
  }
  issues.push(...privacySensitiveIssues(lines, file, ({ source, line, pattern }) => ({
    severity: 'fail',
    code: 'sensitive-content',
    message: `Potential sensitive content detected in ${source}`,
    source,
    line,
    pattern,
  })));
  return { records, issues };
}

function activeRecords(records) {
  return records
    .map((record) => record.value)
    .filter((record) => record.status === 'active')
    .sort((a, b) => {
      const confidenceRank = { high: 0, medium: 1, low: 2 };
      return (confidenceRank[a.confidence] ?? 2) - (confidenceRank[b.confidence] ?? 2)
        || a.category.localeCompare(b.category)
        || b.evidence_count - a.evidence_count
        || a.preference.localeCompare(b.preference);
    });
}

function isUsableRecord(record) {
  if (!record || record.status !== 'active') return false;
  if (record.scope === 'global') return OPERATING_CATEGORIES.has(record.category);
  if (record.scope === 'project') return EXPERIENCE_CATEGORIES.has(record.category) || record.category === 'workflow';
  return false;
}

function usableRecords(records) {
  return activeRecords(records).filter(isUsableRecord);
}

function checkUserProfile(opts = {}) {
  const files = profileFiles(opts);
  const issues = [];
  let globalCheck = { records: [], issues: [] };
  let projectCheck = { records: [], issues: [] };
  try {
    assertSafeDirectory(files.home);
    globalCheck = readJsonl(files.global, files.home);
  } catch (err) {
    issues.push({ severity: 'fail', code: 'global-profile-home-unsafe', message: err.message, source: files.home });
  }
  try {
    if (fs.existsSync(files.projectDir)) assertSafeDirectory(files.projectDir);
    projectCheck = readJsonl(files.project, files.projectDir);
  } catch (err) {
    issues.push({ severity: 'fail', code: 'project-profile-dir-unsafe', message: err.message, source: files.projectDir });
  }
  issues.push(...globalCheck.issues, ...projectCheck.issues);
  const allRecords = [...globalCheck.records, ...projectCheck.records].map((record) => record.value);
  const active = allRecords.filter((record) => record.status === 'active');
  const usable = active.filter(isUsableRecord);
  if (usable.length === 0) {
    issues.push({
      severity: 'warn',
      code: 'profile-empty',
      message: 'No usable active user profile preferences found; agents will use default collaboration and project-style guidance.',
    });
  }
  for (const record of active) {
    if (record.scope === 'global' && !OPERATING_CATEGORIES.has(record.category)) {
      issues.push({ severity: 'warn', code: 'global-experience-preference', message: 'Global user profile should focus on operating preferences; move project look/feel preferences to project scope when possible.', category: record.category });
    }
    if (record.scope === 'project' && !EXPERIENCE_CATEGORIES.has(record.category) && record.category !== 'workflow') {
      issues.push({ severity: 'warn', code: 'project-operating-preference', message: 'Project profile should mostly capture look, feel, copy, accessibility, or project workflow preferences.', category: record.category });
    }
  }
  const failures = issues.filter((item) => item.severity === 'fail');
  const warnings = issues.filter((item) => item.severity === 'warn');
  return {
    schema_version: '1',
    status: failures.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass',
    files: {
      global: files.global,
      project: files.project,
    },
    records: {
      global: globalCheck.records.length,
      project: projectCheck.records.length,
      active: active.length,
      usable: usable.length,
    },
    issues,
  };
}

function renderEntry(record) {
  const applies = record.applies_to.join(', ');
  const evidence = record.evidence ? ` Evidence: ${record.evidence}` : '';
  return `- [${record.confidence}] ${record.category}: ${record.preference}\n  - Applies: ${applies}\n  - Agent guidance: ${record.agent_guidance}\n  - Source: ${record.source}; evidence ${record.evidence_count}.${evidence}`;
}

function renderUserProfile(result) {
  const lines = [
    '# Forgeflow User Profile',
    '',
    `Status: ${result.check.status}`,
    '',
    'This profile is advisory. It guides collaboration style and project look/feel, but it never overrides correctness, safety, security, accessibility, validation evidence, explicit current-turn instructions, or product judgment.',
    '',
    '## User Operating Preferences',
    '',
  ];
  const operating = result.records.filter((record) => record.scope === 'global' && isUsableRecord(record));
  lines.push(...(operating.length > 0 ? operating.map(renderEntry) : ['- (none)']));
  lines.push('', '## Project Experience Preferences', '');
  const project = result.records.filter((record) => record.scope === 'project' && isUsableRecord(record));
  lines.push(...(project.length > 0 ? project.map(renderEntry) : ['- (none)']));
  if (result.check.issues.length > 0) {
    lines.push('', '## Quality Notes', '');
    for (const issue of result.check.issues.slice(0, 8)) {
      lines.push(`- ${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`);
    }
  }
  lines.push('', '## Boundaries', '');
  lines.push('- Treat explicit current-turn instructions as higher priority than stored preferences.');
  lines.push('- Treat inferred or low-confidence preferences as weak guidance only.');
  lines.push('- Surface conflicts when preference guidance would affect security, validation evidence, accessibility, correctness, or scope.');
  return `${lines.join('\n')}\n`;
}

function showUserProfile(opts = {}) {
  const files = profileFiles(opts);
  const globalRecords = readJsonl(files.global, files.home).records.map((record) => record.value);
  const projectRecords = readJsonl(files.project, files.projectDir).records.map((record) => record.value);
  const records = usableRecords([...globalRecords, ...projectRecords].map((value, index) => ({ line: index + 1, value })));
  const check = checkUserProfile(opts);
  const result = {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    files: {
      global: files.global,
      project: files.project,
    },
    check,
    records,
  };
  result.markdown = renderUserProfile(result);
  if (opts.out) writeFileSafe(opts.out, result.markdown);
  return result;
}

function compactUserProfile(opts = {}, maxChars = 3000) {
  const result = showUserProfile(opts);
  if (result.check.status !== 'pass') {
    return {
      markdown: [
        '# Forgeflow User Profile - Quality Gate',
        '',
        `User profile guidance was not injected because the quality check returned ${result.check.status.toUpperCase()}.`,
        'Proceed from current instructions, current code, tests, and review evidence.',
        '',
        'Issues:',
        ...result.check.issues.slice(0, 6).map((item) => `- ${item.severity.toUpperCase()} ${item.code}: ${item.message}`),
      ].join('\n'),
      result,
      injected: false,
    };
  }
  const markdown = result.markdown.length > maxChars
    ? `${result.markdown.slice(0, Math.max(0, maxChars - 80)).trimEnd()}\n\n[truncated to ${maxChars} chars]\n`
    : result.markdown;
  return { markdown, result, injected: true };
}

module.exports = {
  VALID_APPLIES_TO,
  VALID_CATEGORIES,
  VALID_CONFIDENCE,
  VALID_SCOPES,
  VALID_SOURCES,
  VALID_STATUS,
  checkUserProfile,
  compactUserProfile,
  defaultHome,
  defaultProjectDir,
  globalProfileFile,
  normalizeEntry,
  profileFiles,
  projectProfileFile,
  recordUserProfile,
  renderUserProfile,
  showUserProfile,
  usableRecords,
};
