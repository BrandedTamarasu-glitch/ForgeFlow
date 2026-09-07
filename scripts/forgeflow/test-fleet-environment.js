#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { validateContract, inspectFleet } = require('./fleet-environment');

function contract(base = 'a'.repeat(40)) {
  return { schema_version: '1', cleanup: 'preserve-on-failure', shards: ['a', 'b'].map((id, index) => ({
    id, worktree: `.worktrees/${id}`, base, files: [`src/${id}`], ports: [24000 + index], resources: [`data_${id}`],
    setup: [], validation: [['node', '--test']],
  })) };
}

function runGit(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function repository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-fleet-env-'));
  runGit(root, 'init', '-q');
  fs.writeFileSync(path.join(root, '.gitignore'), '.worktrees/\n');
  fs.mkdirSync(path.join(root, 'src/a'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/a/file'), 'original');
  runGit(root, 'add', '.gitignore', 'src/a/file');
  runGit(root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'fixture');
  for (const id of ['a', 'b']) runGit(root, 'worktree', 'add', '--detach', `.worktrees/${id}`, 'HEAD');
  return root;
}

test('validates ownership, resources, paths, and argv without executing commands', () => {
  assert.equal(validateContract(contract()).shards.length, 2);
  const invalid = [
    value => { value.shards[1].files = ['src']; },
    value => { value.shards[1].ports = value.shards[0].ports; },
    value => { value.shards[1].resources = value.shards[0].resources; },
    value => { value.shards[0].worktree = '../outside'; },
    value => { value.shards[0].files = ['src/*']; },
    value => { value.shards[0].validation = ['node --test']; },
    value => { value.shards[0].validation = [['node', '\0']]; },
    value => { value.cleanup = 'delete-on-failure'; },
    value => { value.shards[0].base = '--all'; },
    value => { delete value.shards[0].base; },
    value => { value.shards[0].base = 'HEAD'; },
    value => { value.shards[0].base = 'main'; },
    value => { value.shards[0].base = 'abcdef1'; },
  ];
  for (const mutate of invalid) { const value = contract(); mutate(value); assert.throws(() => validateContract(value)); }
});

test('inspects committed, staged, deleted, and untracked ownership; rejects unrelated repos and symlinks', () => {
  const root = repository();
  try {
    const input = contract(runGit(root, 'rev-parse', 'HEAD'));
    const shard = path.join(root, '.worktrees/a');
    input.shards[0].base = runGit(root, 'rev-parse', 'HEAD');
    fs.writeFileSync(path.join(shard, 'src/a/file'), 'committed change');
    runGit(shard, 'add', 'src/a/file');
    runGit(shard, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'shard');
    assert.deepEqual(inspectFleet(input, root).shards[0].changed, ['src/a/file']);
    fs.unlinkSync(path.join(shard, 'src/a/file'));
    fs.writeFileSync(path.join(shard, 'unowned file'), 'untracked');
    fs.writeFileSync(path.join(shard, 'staged'), 'staged');
    runGit(shard, 'add', 'staged');
    const result = inspectFleet(input, root);
    assert.equal(result.status, 'attention');
    assert.deepEqual(result.shards[0].unowned, ['staged', 'unowned file']);
    input.shards[0].setup = [[process.execPath, '-e', "require('fs').writeFileSync('executed','unexpected')"]];
    const contractFile = path.join(root, 'contract.json');
    fs.writeFileSync(contractFile, JSON.stringify(input));
    const cli = spawnSync(process.execPath, [path.join(__dirname, 'fleet-environment.js'), '--contract', contractFile, '--root', root], { encoding: 'utf8' });
    assert.equal(cli.status, 1);
    assert.equal(JSON.parse(cli.stdout).status, 'attention');
    assert.equal(fs.existsSync(path.join(shard, 'executed')), false);
    fs.symlinkSync(path.join(root, '.worktrees/b'), path.join(root, 'linked'));
    input.shards[1].worktree = 'linked';
    assert.throws(() => inspectFleet(input, root), /symlink/);
    fs.mkdirSync(path.join(root, 'unrelated'));
    runGit(path.join(root, 'unrelated'), 'init', '-q');
    input.shards[1].worktree = 'unrelated';
    assert.throws(() => inspectFleet(input, root), /different repository/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('pinned starting commit exposes committed unowned files and missing or moving bases cannot report ready', () => {
  const root = repository();
  try {
    const input = contract(runGit(root, 'rev-parse', 'HEAD'));
    const shard = path.join(root, '.worktrees/a');
    fs.writeFileSync(path.join(shard, 'unowned'), 'committed outside ownership');
    runGit(shard, 'add', 'unowned');
    runGit(shard, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'unowned change');
    assert.equal(runGit(shard, 'status', '--porcelain'), '', 'Reproduction requires a clean committed worktree');
    const result = inspectFleet(input, root);
    assert.equal(result.status, 'attention');
    assert.deepEqual(result.shards[0].unowned, ['unowned']);
    for (const base of [undefined, 'HEAD', 'HEAD~1', 'main']) {
      input.shards[0].base = base;
      assert.throws(() => inspectFleet(input, root), /pinned full starting commit SHA/);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('staged unowned changes remain visible when unstaged edits cancel their bytes', () => {
  const root = repository();
  try {
    const input = contract(runGit(root, 'rev-parse', 'HEAD'));
    input.shards[0].files = ['owned'];
    const shard = path.join(root, '.worktrees/a');
    fs.writeFileSync(path.join(shard, 'src/a/file'), 'staged unowned change');
    runGit(shard, 'add', 'src/a/file');
    fs.writeFileSync(path.join(shard, 'src/a/file'), 'original');
    assert.equal(runGit(shard, 'diff', '--name-only', input.shards[0].base), '', 'Net base-to-worktree diff hides the staged change');
    assert.equal(runGit(shard, 'diff', '--cached', '--name-only'), 'src/a/file');
    const result = inspectFleet(input, root);
    assert.equal(result.status, 'attention');
    assert.deepEqual(result.shards[0].changed, ['src/a/file']);
    assert.deepEqual(result.shards[0].unowned, ['src/a/file']);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('committed unowned changes remain visible when the index restores the starting bytes', () => {
  const root = repository();
  try {
    const input = contract(runGit(root, 'rev-parse', 'HEAD'));
    input.shards[0].files = ['owned'];
    const shard = path.join(root, '.worktrees/a');
    fs.writeFileSync(path.join(shard, 'src/a/file'), 'committed unowned change');
    runGit(shard, 'add', 'src/a/file');
    runGit(shard, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'unowned change');
    fs.writeFileSync(path.join(shard, 'src/a/file'), 'original');
    runGit(shard, 'add', 'src/a/file');
    assert.equal(runGit(shard, 'diff', '--cached', '--name-only', input.shards[0].base), '', 'Net base-to-index diff hides the committed change');
    assert.equal(runGit(shard, 'diff', '--name-only'), '', 'Worktree matches the index');
    const result = inspectFleet(input, root);
    assert.equal(result.status, 'attention');
    assert.deepEqual(result.shards[0].changed, ['src/a/file']);
    assert.deepEqual(result.shards[0].unowned, ['src/a/file']);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

function startService(cwd, resource, content, children) {
  fs.writeFileSync(path.join(cwd, resource), content);
  const code = `const http=require('http'),fs=require('fs');const server=http.createServer((req,res)=>res.end(fs.readFileSync(process.argv[1])));server.listen(0,'127.0.0.1',()=>process.stdout.write(String(server.address().port)+'\\n'));process.on('SIGTERM',()=>server.close(()=>process.exit(0)));`;
  const child = spawn(process.execPath, ['-e', code, resource], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Service start timed out')), 10000);
    let output = '';
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Service exited ${code}: ${stderr}`)); });
    child.stdout.on('data', chunk => {
      output += chunk;
      if (output.includes('\n')) { clearTimeout(timer); resolve(Number(output.trim())); }
    });
  });
}

function request(port) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: '127.0.0.1', port, path: '/', timeout: 3000 }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve(body));
    });
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
  });
}

test('two service shards use distinct live ports and data resources without cross-talk', async () => {
  const root = repository();
  const children = [];
  try {
    const input = contract(runGit(root, 'rev-parse', 'HEAD'));
    const ports = await Promise.all(input.shards.map(shard => startService(path.join(root, shard.worktree), shard.resources[0], shard.id, children)));
    assert.notEqual(ports[0], ports[1]);
    input.shards.forEach((shard, index) => { shard.ports = [ports[index]]; shard.files.push(shard.resources[0]); });
    assert.equal(inspectFleet(input, root).status, 'ready');
    assert.deepEqual(await Promise.all(ports.map(request)), ['a', 'b']);
    fs.writeFileSync(path.join(root, input.shards[0].worktree, 'data_a'), 'a changed');
    assert.deepEqual(await Promise.all(ports.map(request)), ['a changed', 'b']);
  } finally {
    await Promise.all(children.map(child => new Promise(resolve => {
      if (child.exitCode !== null || child.signalCode !== null || !child.pid) return resolve();
      const timer = setTimeout(() => child.kill('SIGKILL'), 2000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
      child.kill('SIGTERM');
    })));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
