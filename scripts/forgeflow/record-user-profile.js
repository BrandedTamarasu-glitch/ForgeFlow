#!/usr/bin/env node
const path = require('path');
const { recordUserProfile } = require('./user-profile');

function usage() {
  console.error([
    'Usage: record-user-profile.js --scope global|project --category <category> --preference <text> [--evidence <text>] [--confidence low|medium|high] [--evidence-count <n>]',
    '       [--source explicit-user-instruction|repeated-user-behavior|user-correction|accepted-workflow|inferred] [--status active|stale|superseded]',
    '       [--applies-to comma,list] [--agent-guidance <text>] [--superseded-by <text>] [--project-dir <dir>] [--home <dir>] [--json]',
  ].join('\n'));
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
    if (arg === '--scope') opts.scope = requireValue(argv, arg, i++);
    else if (arg === '--category') opts.category = requireValue(argv, arg, i++);
    else if (arg === '--preference') opts.preference = requireValue(argv, arg, i++);
    else if (arg === '--evidence') opts.evidence = requireValue(argv, arg, i++);
    else if (arg === '--confidence') opts.confidence = requireValue(argv, arg, i++);
    else if (arg === '--evidence-count') opts.evidenceCount = Number.parseInt(requireValue(argv, arg, i++), 10);
    else if (arg === '--source') opts.source = requireValue(argv, arg, i++);
    else if (arg === '--status') opts.status = requireValue(argv, arg, i++);
    else if (arg === '--applies-to') opts.appliesTo = requireValue(argv, arg, i++);
    else if (arg === '--agent-guidance') opts.agentGuidance = requireValue(argv, arg, i++);
    else if (arg === '--superseded-by') opts.supersededBy = requireValue(argv, arg, i++);
    else if (arg === '--project-dir') opts.projectDir = path.resolve(requireValue(argv, arg, i++));
    else if (arg === '--home') opts.home = path.resolve(requireValue(argv, arg, i++));
    else if (arg === '--json') opts.json = true;
    else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!opts.scope || !opts.category || !opts.preference) {
    usage();
    process.exit(2);
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = recordUserProfile(opts);
  if (opts.json) {
    console.log(JSON.stringify({ file: result.file, entry: result.entry }, null, 2));
  } else {
    console.log(`User profile updated: ${result.file}`);
    console.log(`Preference: ${result.entry.preference}`);
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
