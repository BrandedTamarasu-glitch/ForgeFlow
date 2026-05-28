#!/usr/bin/env node
const path = require('path');
const { showUserProfile } = require('./user-profile');

function usage() {
  console.error('Usage: show-user-profile.js [--project-dir <dir>] [--home <dir>] [--out <file>] [--json]');
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
    else if (arg === '--out') opts.out = path.resolve(requireValue(argv, arg, i++));
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

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = showUserProfile(opts);
  if (opts.json) {
    const { markdown: _markdown, ...json } = result;
    console.log(JSON.stringify(json, null, 2));
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

module.exports = { parseArgs };
