#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { checkProjectLearnings } = require('./check-project-learnings');
const { rollupProjectLearnings } = require('./rollup-project-learnings');
const { showCodeMap } = require('./show-code-map');

const SECTION_ORDER = [
  'Recommended Approach For Next Work',
  'Recurring Pitfalls',
  'Risk Areas',
  'Validation Patterns',
  'Hot Files And Modules',
  'Stable Decisions',
  'Repeated Follow-ups',
];

function usage() {
  console.error('Usage: show-project-learnings.js [--project-dir <dir>] [--check] [--json]');
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
    check: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i, exitOnError));
      i += 1;
    } else if (arg === '--check') {
      opts.check = true;
    } else if (arg === '--json') {
      opts.json = true;
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

function samePath(left, right) {
  return path.resolve(left || '') === path.resolve(right || '');
}

function shouldRefreshProjectCodeMap(root, projectDir, opts = {}) {
  if (typeof opts.refreshCodeMap === 'boolean') return opts.refreshCodeMap;
  return samePath(projectDir, defaultProjectDir(root));
}

function sectionItems(markdown, heading) {
  const lines = String(markdown || '').split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) return [];
  const items = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    if (line.trim().startsWith('- ')) items.push(line.trim());
  }
  return items.length > 0 ? items : ['- No repeated pattern recorded yet.'];
}

function renderProjectLearningsView(projectName, artifact, markdown) {
  const lines = [
    `# Forgeflow Project Learnings - ${projectName}`,
    '',
    `Artifact: ${artifact}`,
    '',
  ];
  for (const section of SECTION_ORDER) {
    lines.push(`## ${section}`, '', ...sectionItems(markdown, section), '');
  }
  lines.push('Use these as guidance only. Verify every current decision against the current code, tests, and review artifacts.');
  return `${lines.join('\n')}\n`;
}

function readJson(file) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_err) {
    return null;
  }
}

function contextPackSmoke(root, projectDir) {
  if (!samePath(projectDir, defaultProjectDir(root))) {
    return {
      status: 'skipped',
      reason: 'external-project-dir',
      out_dir: '',
      packet_count: 0,
      agents: [],
      latest_insights_report: '',
      latest_insights_status: '',
      latest_insights_reason: '',
      stderr: '',
    };
  }
  const out = path.join(projectDir, 'context', 'latest');
  const helper = path.join(__dirname, 'build-context-pack.js');
  const result = spawnSync(process.execPath, [helper, '--out', out, '--json'], {
    cwd: root,
    encoding: 'utf8',
  });
  const parsed = result.status === 0 && result.stdout.trim() ? readJsonFromString(result.stdout) : null;
  const reportPath = path.join(out, 'latest-insights-report.json');
  const report = readJson(reportPath);
  return {
    status: result.status === 0 ? 'pass' : 'fail',
    exit_code: result.status,
    out_dir: out,
    packet_count: parsed ? parsed.packet_count : 0,
    agents: parsed && Array.isArray(parsed.agents) ? parsed.agents : [],
    latest_insights_report: reportPath,
    latest_insights_status: report ? report.status : '',
    latest_insights_reason: report ? report.reason : '',
    stderr: result.status === 0 ? '' : String(result.stderr || '').trim().slice(0, 1000),
  };
}

function readJsonFromString(value) {
  try {
    return JSON.parse(value);
  } catch (_err) {
    return null;
  }
}

function renderCheckSummary(result) {
  const lines = [
    '',
    '## Learning Loop Check',
    '',
    `- Quality gate: ${result.check.status}`,
  ];
  if (result.context_smoke) {
    lines.push(`- Context-pack smoke: ${result.context_smoke.status}`);
    lines.push(`- Latest-insights injection: ${result.context_smoke.latest_insights_status || 'unknown'}`);
    lines.push(`- Agent packets: ${result.context_smoke.packet_count}`);
  }
  if (result.check.issues.length > 0) {
    lines.push('', '### Gate Issues', '');
    for (const issue of result.check.issues.slice(0, 8)) {
      lines.push(`- ${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`);
    }
  }
  return lines.join('\n');
}

function showProjectLearnings(opts = {}) {
  const root = repoRoot();
  const projectDir = opts.projectDir || defaultProjectDir(root);
  if (shouldRefreshProjectCodeMap(root, projectDir, opts)) {
    showCodeMap({ root, projectDir });
  }
  const rollupOpts = { projectDir };
  if (Object.prototype.hasOwnProperty.call(opts, 'codeMap')) rollupOpts.codeMap = opts.codeMap;
  const rollup = rollupProjectLearnings(rollupOpts);
  const markdown = fs.readFileSync(rollup.out, 'utf8');
  const result = {
    ...rollup,
    markdown: renderProjectLearningsView(path.basename(projectDir), rollup.out, markdown),
  };
  if (opts.check) {
    result.check = checkProjectLearnings({ projectDir });
    result.context_smoke = result.check.status === 'pass'
      ? contextPackSmoke(root, projectDir)
      : null;
    result.latest_insights_ready = Boolean(
      result.context_smoke
      && result.context_smoke.status === 'pass'
      && result.context_smoke.latest_insights_status === 'injected'
    );
    result.markdown += renderCheckSummary(result);
    result.markdown += '\n';
  }
  return result;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = showProjectLearnings(opts);
  if (opts.json) {
    const { markdown: _markdown, ...json } = result;
    process.stdout.write(`${JSON.stringify(json, null, 2)}\n`);
  } else {
    process.stdout.write(result.markdown);
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
  parseArgs,
  renderProjectLearningsView,
  sectionItems,
  shouldRefreshProjectCodeMap,
  showProjectLearnings,
};
