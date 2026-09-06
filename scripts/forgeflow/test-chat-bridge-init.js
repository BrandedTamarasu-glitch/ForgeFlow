#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');

async function main() {
  if (process.platform === 'win32' || ['bash', 'curl', 'jq'].some(command => spawnSync(command, ['--version']).status !== 0)) {
    console.log('SKIP bridge shell integration requires bash, curl, and jq'); return;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-init-'));
  const hash = crypto.createHash('sha256').update(root).digest('hex').slice(0, 8);
  const files = ['pid', 'token'].map(ext => `/tmp/chat-bridge-${hash}.${ext}`);
  const ownedFiles = [];
  const events = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (req.url !== '/health') {
        assert.equal(req.headers['x-forgeflow-token'], 'fixture-only');
        if (req.url === '/lifecycle') events.push(JSON.parse(body));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
    });
  });
  try {
    assert.equal(spawnSync('git', ['init', '-q', root]).status, 0);
    for (const file of files) assert.ok(!fs.existsSync(file));
    fs.writeFileSync(files[0], String(process.pid), { flag: 'wx', mode: 0o600 });
    ownedFiles.push(files[0]);
    fs.writeFileSync(files[1], 'fixture-only', { flag: 'wx', mode: 0o600 });
    ownedFiles.push(files[1]);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const script = path.resolve(__dirname, '../../services/chat-bridge/init-session.sh');
    for (const command of ['plan', 'implement', 'quick', 'aegis-verify', 'custom-command']) {
      await new Promise((resolve, reject) => {
        const child = spawn('bash', ['-c', 'source "$1" "$2" ""', 'ember-test', script, command], {
          cwd: root, env: { ...process.env, FORGEFLOW_DASHBOARD_AUTO_OPEN: 'off', CHAT_BRIDGE_PORT: String(server.address().port) }, stdio: 'pipe', timeout: 5000,
        });
        let errors = ''; child.stderr.on('data', data => { errors += data; });
        child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(errors || `exit ${code}`)));
      });
    }
    assert.deepEqual(events, [
      { event: 'phase_start', data: 'plan', state: 'planning' },
      { event: 'phase_start', data: 'implement', state: 'implementing' },
      { event: 'phase_start', data: 'quick', state: 'planning' },
      { event: 'phase_start', data: 'aegis-verify', state: 'reviewing' },
      { event: 'phase_start', data: 'custom-command' },
    ]);
    console.log('Bridge reuse reports each known phase and leaves unknown commands without an activity state.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    for (const file of ownedFiles) { try { fs.unlinkSync(file); } catch (err) { if (err.code !== 'ENOENT') throw err; } }
    fs.rmSync(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
