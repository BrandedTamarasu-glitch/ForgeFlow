#!/usr/bin/env node
'use strict';
const path = require('path');
const evidence = require('./review-evidence');
const questions = require('./review-questions');
function parse(argv) {
  const command = argv.shift(), options = {};
  if (!['start', 'inspect', 'request', 'challenge', 'response', 'synthesis'].includes(command)) throw new Error('Unknown operation');
  while (argv.length) {
    const key = argv.shift();
    if (!['--root', '--session', '--input', '--json'].includes(key) || Object.hasOwn(options, key)) throw new Error('Unknown or duplicate argument');
    if (key === '--json') options[key] = true;
    else { const value = argv.shift(); if (!value || value.startsWith('--')) throw new Error('Missing argument'); options[key] = value; }
  }
  if (!options['--root'] || !options['--json']) throw new Error('Explicit --root and --json required');
  if ((command === 'start') === !!options['--session']) throw new Error('Explicit session required except at start');
  if (['start', 'request', 'challenge', 'response'].includes(command) !== !!options['--input']) throw new Error('Unexpected or missing input');
  return { command, options };
}
try {
  const { command, options } = parse(process.argv.slice(2)), root = path.resolve(options['--root']);
  const input = options['--input'] ? JSON.parse(evidence.readInputFile({ path: path.resolve(root, options['--input']), root, maxBytes: 65536 }).toString('utf8')) : null;
  let result;
  if (command === 'start') {
    if (!input || Object.keys(input).some(key => !['schema_version', 'evidence_ref', 'required_reviewers', 'assignments', 'limits'].includes(key)) || input.schema_version !== '1') throw new Error('Invalid session input');
    result = questions.startSession({ root, evidenceRef: input.evidence_ref, requiredReviewers: input.required_reviewers, assignments: input.assignments, limits: input.limits });
  } else {
    const request = { root, sessionRef: options['--session'] };
    if (command === 'inspect') result = questions.inspectSession(request);
    else if (command === 'request') result = questions.resolveRequest({ ...request, request: input });
    else if (command === 'challenge') result = questions.prepareChallenge({ ...request, challenge: input });
    else if (command === 'response') result = questions.recordResponse({ ...request, response: input });
    else result = questions.prepareSynthesis(request);
  }
  // Exactly these bytes are budgeted for request resolutions; no added whitespace or newline.
  process.stdout.write(JSON.stringify(result));
} catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
