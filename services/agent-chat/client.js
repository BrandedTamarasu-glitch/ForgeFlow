#!/usr/bin/env node
'use strict';

// Read credentials directly; never include them in command arguments or URLs.
const http = require('node:http');
const { readToken } = require('./session-auth');

function sendActivity(state, label = '', options = {}) {
  if (process.env.FORGEFLOW_ACTIVITY === 'off') return Promise.resolve(false);
  return new Promise(resolve => {
    let token;
    try { token = readToken(options.tokenFile); } catch { resolve(false); return; }
    const body = JSON.stringify({ agent: options.agent || 'fc', state, label });
    const req = http.request({ hostname: '127.0.0.1', port: options.port || 4001, path: '/activity', method: 'POST',
      headers: { 'x-forgeflow-token': token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
      res.resume();
      resolve(res.statusCode === 204);
    });
    req.setTimeout(400, () => req.destroy());
    req.on('error', () => resolve(false));
    req.end(body);
  });
}

function main() {
  const endpoint = process.argv[2];
  if (endpoint === 'activity') {
    const state = process.argv[3];
    const label = process.argv[4] || '';
    const agent = process.argv[5] || 'fc';
    return sendActivity(state, label, { agent }).then(ok => {
      if (!ok) { process.stderr.write('Activity not delivered; check the state and local chat connection.\n'); process.exitCode = 1; }
    });
  }
  if (!['/export', '/auto-save-path'].includes(endpoint)) {
    process.stderr.write('Usage: node client.js /export|/auto-save-path OR activity <state> [label] [agent]\n');
    process.exitCode = 1;
    return;
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
}
if (require.main === module) main();
module.exports = { sendActivity };
