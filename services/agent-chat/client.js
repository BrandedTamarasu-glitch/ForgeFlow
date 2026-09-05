#!/usr/bin/env node
'use strict';

// Read the private credential directly: never put it in shell arguments or URLs.
const http = require('node:http');
const { readToken } = require('./session-auth');
const endpoint = process.argv[2];
if (!['/export', '/auto-save-path'].includes(endpoint)) {
  process.stderr.write('Usage: node client.js /export|/auto-save-path\n');
  process.exit(1);
}
try {
  const req = http.get({ hostname: '127.0.0.1', port: 4001, path: endpoint,
    headers: { 'x-forgeflow-token': readToken() } }, res => {
    if (res.statusCode !== 200) {
      res.resume();
      process.stderr.write(`Agent-chat request failed (${res.statusCode})\n`);
      process.exitCode = 1;
    } else res.pipe(process.stdout);
  });
  req.setTimeout(2_000, () => req.destroy(new Error('Request timed out')));
  req.on('error', () => { process.stderr.write('Agent-chat request failed\n'); process.exitCode = 1; });
} catch {
  process.stderr.write('Agent-chat credential unavailable; start the current server first\n');
  process.exitCode = 1;
}
