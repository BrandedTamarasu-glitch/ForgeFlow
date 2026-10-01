#!/usr/bin/env node
'use strict';
const path = require('path');
const evidence = require('./review-evidence');
function argumentsFor(argv) {
  const options = { command: argv.shift() };
  while (argv.length) {
    const key = argv.shift();
    if (!key.startsWith('--')) throw new Error('Expected named argument');
    if (['--require-current', '--raw-required'].includes(key)) options[key.slice(2)] = true;
    else { if (!argv.length || argv[0].startsWith('--')) throw new Error(`Missing ${key}`); options[key.slice(2)] = argv.shift(); }
  }
  return options;
}
try {
  const options = argumentsFor(process.argv.slice(2)), root = path.resolve(options.root || process.cwd());
  let ref = options.ref;
  if (options.run) {
    const runDir = path.join(root, '.forgeflow', path.basename(root), 'context', 'runs', options.run);
    ref = { schema_version: '1', run_id: options.run, run_dir: runDir, manifest_path: path.join(runDir, 'manifest.json'), manifest_sha256: null, scope: JSON.parse(options.scope || '[]') };
  }
  const request = { root, ref };
  let result;
  if (options.command === 'inspect') {
    result = evidence.inspectRun(request);
    if (options['require-current'] && (result.build_state !== 'complete' || result.integrity !== 'current' || result.source !== 'current')) process.exitCode = 1;
  } else if (options.command === 'inspect-consumption') {
    result = evidence.inspectConsumption(request);
    if (options['require-current'] && (result.build_state !== 'complete' || result.integrity !== 'current' || result.source !== 'current')) process.exitCode = 1;
  } else if (options.command === 'retrieve') {
    result = evidence.retrieveArtifact({ ...request, artifactId: options.artifact, startLine: options['start-line'] ? Number(options['start-line']) : undefined, endLine: options['end-line'] ? Number(options['end-line']) : undefined, maxChars: options['max-chars'] ? Number(options['max-chars']) : undefined, rawRequired: options['raw-required'] });
  } else if (options.command === 'record') {
    result = evidence.recordConsumption({ ...request, id: options.id, kind: options.kind, resultPath: options.result, decisionPath: options.decision, artifactIds: (options.artifacts || '').split(',').filter(Boolean) });
  } else throw new Error('Use inspect, inspect-consumption, retrieve or record with explicit --root and --ref');
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
