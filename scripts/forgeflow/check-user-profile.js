#!/usr/bin/env node
const path = require('path');
const { checkUserProfile } = require('./user-profile');

function usage() {
  console.error('Usage: check-user-profile.js [--project-dir <dir>] [--home <dir>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-dir') opts.projectDir = path.resolve(requireValue(argv, arg, i++));
    else if (arg === '--home') opts.home = path.resolve(requireValue(argv, arg, i++));
    else if (arg === '--json') opts.json = true;
    else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function render(result) {
  const lines = [
    `# Forgeflow User Profile Check: ${result.status.toUpperCase()}`,
    '',
    `Global file: ${result.files.global}`,
    `Project file: ${result.files.project}`,
    `Records: global ${result.records.global}, project ${result.records.project}, active ${result.records.active}`,
    '',
  ];
  if (result.issues.length === 0) {
    lines.push('No issues found.');
  } else {
    for (const issue of result.issues) {
      lines.push(`- ${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = checkUserProfile(opts);
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    process.stdout.write(render(result));
  }
  if (result.status === 'fail') process.exit(1);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { parseArgs, render };
