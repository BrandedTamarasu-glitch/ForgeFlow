#!/usr/bin/env node
const path = require('path');
const { buildInsightInjection } = require('./render-insight-injection');
const { buildPostReleaseInstallVerify } = require('./render-post-release-install-verify');
const { buildProjectHealthTimeline } = require('./show-project-health-timeline');

function usage() {
  console.error('Usage: next-action-contract.js [--root <dir>] [--project-dir <dir>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function isCommandOnly(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/[!?]/.test(text) || /\.(?:\s|$)/.test(text)) return false;
  if (/,\s*(then|before|after|and)\b/i.test(text)) return false;
  if (/\b(then|before|after|because|when|once|first)\b/i.test(text)) return false;
  return /^([/$A-Za-z0-9_.-][A-Za-z0-9_./:$-]*)(\s+[-/@:.,=A-Za-z0-9_./$"']+|(\s+&&\s+\/?[A-Za-z0-9_.:-]+))*$/.test(text);
}

function walkNextValues(value, source, out = []) {
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkNextValues(item, `${source}[${index}]`, out));
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${source}.${key}`;
    if ((key === 'next' || key === 'next_action' || key === 'next_command') && typeof child === 'string' && child.trim()) {
      out.push({ source: childPath, value: child });
    } else if (child && typeof child === 'object') {
      walkNextValues(child, childPath, out);
    }
  }
  return out;
}

function fakeRelease(root) {
  return {
    status: 'install-attention',
    version: '4.3.31',
    tag: 'v4.3.31',
    head: 'abc1234',
    next_command: '/forgeflow-release-verify',
    local_consumability: { status: 'attention' },
  };
}

function fakeSmoke() {
  return { status: 'warn', checks: [{ name: 'health', status: 'warn', command: '/forgeflow-health' }] };
}

function buildNextActionContract(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const samples = [
    { name: 'insight-injection', result: buildInsightInjection({ root, projectDir }) },
    { name: 'project-health-timeline', result: buildProjectHealthTimeline({ root, projectDir }) },
    { name: 'post-release-install-verify', result: buildPostReleaseInstallVerify({ root, release: fakeRelease(root), smoke: fakeSmoke() }) },
  ];
  const checked = samples.flatMap((sample) => walkNextValues(sample.result, sample.name));
  const issues = checked
    .filter((item) => !isCommandOnly(item.value))
    .map((item) => ({
      severity: 'fail',
      code: 'next-action-not-command-only',
      source: item.source,
      value: item.value,
      message: 'Move explanatory prose to next_reason and keep next copy-pastable.',
    }));
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    project_dir: projectDir,
    status: issues.length > 0 ? 'fail' : 'pass',
    checked_count: checked.length,
    issues,
    next: issues.length > 0 ? 'fix-next-action-contract' : '/forgeflow-output-contract',
    next_reason: issues.length > 0 ? 'Move prose out of next fields before relying on helper output.' : 'Run the broader representative output contract audit.',
    boundary: 'Next-action audit is read-only. It checks helper output shape only and does not run next commands.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Next Action Audit',
    '',
    `Status: ${result.status}`,
    `Checked: ${result.checked_count}`,
    '',
    result.boundary,
    '',
    '## Issues',
    '',
  ];
  if (result.issues.length === 0) lines.push('- None.');
  else for (const issue of result.issues) {
    lines.push(`- ${issue.source}: ${issue.value}`);
    lines.push(`  - ${issue.message}`);
  }
  lines.push('', `Next: ${result.next}`, `Why: ${result.next_reason}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildNextActionContract(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  if (result.status === 'fail') process.exit(1);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    usage();
    process.exit(1);
  }
}

module.exports = {
  buildNextActionContract,
  isCommandOnly,
  parseArgs,
  renderMarkdown,
  walkNextValues,
};
