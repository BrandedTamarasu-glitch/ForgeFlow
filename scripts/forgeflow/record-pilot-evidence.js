#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { sensitiveMatches } = require('./privacy-boundary');
const { rollupPilotEvidence } = require('./rollup-pilot-evidence');

const FIELDS = [
  'pilot_id',
  'date',
  'maintainer',
  'runtime',
  'project_type',
  'branch_shape',
  'install_path',
  'health_result',
  'version_result',
  'sharing_level',
  'review_mode',
  'confirmed_findings',
  'rejected_findings',
  'deferred_findings',
  'review_minutes',
  'setup_friction',
  'support_categories',
  'context_budget_status',
  'project_intelligence_readiness',
  'living_project_map_status',
  'agent_feedback_signal',
  'public_summary_generated',
  'adoption_decision',
  'next_action',
];

const CHOICES = {
  runtime: new Set(['claude-code', 'codex']),
  project_type: new Set(['frontend', 'api', 'monorepo', 'docs-config', 'release-prep', 'other']),
  install_path: new Set(['update-forgeflow', 'template-installer', 'existing-install']),
  health_result: new Set(['pass', 'warn', 'fail']),
  version_result: new Set(['up-to-date', 'outdated', 'offline', 'unknown']),
  sharing_level: new Set(['local-maintainer', 'private-team', 'public']),
  public_summary_generated: new Set(['yes', 'no']),
  adoption_decision: new Set(['repeat-pilot', 'expand-small-team', 'stop-and-fix', 'defer']),
  project_intelligence_readiness: new Set(['ready', 'needs-refresh', 'needs-triage', 'blocked', 'unknown']),
  living_project_map_status: new Set(['useful', 'missing', 'unclear', 'not-useful', 'unknown']),
  agent_feedback_signal: new Set(['positive', 'missing', 'unclear', 'negative', 'incorrect', 'unknown']),
};

const NORMALIZERS = {
  project_intelligence_readiness: new Map([
    ['pass', 'ready'],
    ['current', 'ready'],
    ['ok', 'ready'],
    ['needs_refresh', 'needs-refresh'],
    ['needs refresh', 'needs-refresh'],
    ['refresh', 'needs-refresh'],
    ['needs_triage', 'needs-triage'],
    ['needs triage', 'needs-triage'],
    ['triage', 'needs-triage'],
    ['fail', 'blocked'],
    ['failure', 'blocked'],
  ]),
  living_project_map_status: new Map([
    ['present', 'useful'],
    ['clear', 'useful'],
    ['helpful', 'useful'],
    ['not useful', 'not-useful'],
    ['not_useful', 'not-useful'],
    ['no', 'not-useful'],
  ]),
  agent_feedback_signal: new Map([
    ['good', 'positive'],
    ['useful', 'positive'],
    ['clear', 'positive'],
    ['bad', 'negative'],
    ['corrective', 'incorrect'],
  ]),
};

function usage() {
  console.error([
    'Usage: record-pilot-evidence.js [--project-dir <dir>] [--out <path>] [--no-rollup] [--json]',
    '       [--set <field=value>] [--pilot-id <id>] [--runtime <runtime>]',
    '       [--project-type <type>] [--health-result <result>] [--adoption-decision <decision>]',
  ].join('\n'));
}

function argumentError(message, exitOnError) {
  if (exitOnError) {
    console.error(message);
    usage();
    process.exit(2);
  }
  const err = new Error(message);
  err.exitCode = 2;
  throw err;
}

function requireValue(argv, name, index, exitOnError = true) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) {
    argumentError(`Missing value for ${name}`, exitOnError);
  }
  return value;
}

function parseArgs(argv, options = {}) {
  const exitOnError = options.exitOnError !== false;
  const opts = {
    projectDir: '',
    out: '',
    rollup: true,
    json: false,
    values: {},
  };
  const aliases = {
    '--pilot-id': 'pilot_id',
    '--runtime': 'runtime',
    '--project-type': 'project_type',
    '--health-result': 'health_result',
    '--adoption-decision': 'adoption_decision',
    '--next-action': 'next_action',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i, exitOnError));
      i += 1;
    } else if (arg === '--out') {
      opts.out = path.resolve(requireValue(argv, arg, i, exitOnError));
      i += 1;
    } else if (arg === '--set') {
      const pair = requireValue(argv, arg, i, exitOnError);
      const split = pair.indexOf('=');
      if (split <= 0) {
        argumentError(`Invalid --set value: ${pair}`, exitOnError);
      }
      opts.values[pair.slice(0, split)] = pair.slice(split + 1);
      i += 1;
    } else if (aliases[arg]) {
      opts.values[aliases[arg]] = requireValue(argv, arg, i, exitOnError);
      i += 1;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--no-rollup') {
      opts.rollup = false;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      if (exitOnError) process.exit(0);
      return opts;
    } else {
      argumentError(`Unknown argument: ${arg}`, exitOnError);
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function slug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'pilot';
}

function yamlScalar(value) {
  if (value === '') return '';
  if (/^[A-Za-z0-9_.:/@ -]+$/.test(value)) return value;
  return JSON.stringify(value);
}

function normalizeChoice(field, value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' && value !== '' && value.trim() === '') return value;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return '';
  return (NORMALIZERS[field] && NORMALIZERS[field].get(normalized)) || normalized;
}

function normalizeValues(values = {}) {
  const normalized = {};
  for (const [field, value] of Object.entries(values)) {
    normalized[field] = NORMALIZERS[field] ? normalizeChoice(field, value) : value;
  }
  return normalized;
}

function isBlankChoice(value) {
  return value === undefined || value === null || value === '';
}

function validate(values) {
  const errors = [];
  for (const key of Object.keys(values)) {
    if (!FIELDS.includes(key)) {
      errors.push(`Unknown field: ${key}`);
    }
  }
  for (const [key, allowed] of Object.entries(CHOICES)) {
    if (!isBlankChoice(values[key]) && !allowed.has(values[key])) {
      errors.push(`Invalid ${key}`);
    }
  }
  for (const [field, value] of Object.entries(values)) {
    for (const label of sensitiveMatches(value)) {
      errors.push(`Potential sensitive content in ${field} (${label})`);
    }
  }
  return errors;
}

function buildRecord(values = {}) {
  const record = Object.fromEntries(FIELDS.map((field) => [field, '']));
  Object.assign(record, normalizeValues(values));
  if (!record.date) record.date = today();
  if (!record.pilot_id) record.pilot_id = `${record.date}-${slug(record.runtime || 'pilot')}`;
  return record;
}

function renderYaml(record) {
  return `${FIELDS.map((field) => `${field}: ${yamlScalar(record[field] || '')}`).join('\n')}\n`;
}

function recordPilotEvidence(opts = {}) {
  const root = repoRoot();
  const projectDir = opts.projectDir || defaultProjectDir(root);
  const values = normalizeValues(opts.values || {});
  const errors = validate(values);
  if (errors.length > 0) {
    const err = new Error(errors.join('\n'));
    err.errors = errors;
    throw err;
  }
  const record = buildRecord(values);
  const evidenceDir = path.join(projectDir, 'pilot-evidence');
  const out = opts.out || path.join(evidenceDir, `${slug(record.pilot_id)}.yml`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, renderYaml(record), 'utf8');
  let rollup = null;
  if (opts.rollup !== false) {
    const rollupPath = path.join(projectDir, 'pilot-evidence-rollup.md');
    rollup = rollupPilotEvidence({ projectDir, out: rollupPath });
  }
  return {
    schema_version: '1',
    status: 'written',
    path: out,
    project_dir: projectDir,
    rollup_path: rollup ? rollup.out : '',
    rollup_decision: rollup ? rollup.decision : '',
    record,
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = recordPilotEvidence(opts);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    console.log(`Pilot evidence written to ${result.path}`);
    if (result.rollup_path) console.log(`Pilot evidence rollup refreshed at ${result.rollup_path}`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    if (err.errors) {
      console.error(err.errors.join('\n'));
    } else {
      console.error(err.message);
    }
    process.exit(1);
  }
}

module.exports = {
  buildRecord,
  normalizeChoice,
  normalizeValues,
  parseArgs,
  recordPilotEvidence,
  renderYaml,
  validate,
};
