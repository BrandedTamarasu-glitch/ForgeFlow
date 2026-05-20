#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
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
  console.error('Usage: show-project-learnings.js [--project-dir <dir>] [--json]');
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
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
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

function showProjectLearnings(opts = {}) {
  const root = repoRoot();
  const projectDir = opts.projectDir || defaultProjectDir(root);
  if (shouldRefreshProjectCodeMap(root, projectDir, opts)) {
    showCodeMap({ root });
  }
  const rollup = rollupProjectLearnings({ projectDir });
  const markdown = fs.readFileSync(rollup.out, 'utf8');
  return {
    ...rollup,
    markdown: renderProjectLearningsView(path.basename(projectDir), rollup.out, markdown),
  };
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
  renderProjectLearningsView,
  sectionItems,
  shouldRefreshProjectCodeMap,
  showProjectLearnings,
};
