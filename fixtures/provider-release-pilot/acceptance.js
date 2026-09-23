// Hidden checkout-only oracle. Receive a submitted module path, never an arm label.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createServer } = require('node:http');
const hash = body => createHash('sha256').update(body).digest('hex');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

async function evaluate(family, modulePath) {
  const results = [];
  const check = async (id, run) => {
    try { await run(); results.push({ id, pass: true }); }
    catch (error) { results.push({ id, pass: false, reason: error.message }); }
  };
  delete require.cache[require.resolve(modulePath)];
  const subject = require(modulePath);
  if (family === 'provider') {
    const reading = (value, observedAt = 10) => ({ version: 1, value, observedAt });
    await check('freshness-detached-and-zero', async () => {
      let now = 10; const c = subject.createCache(() => now, 5);
      assert.deepEqual(c.view('new'), { value: null, observedAt: null, freshness: 'missing', error: null });
      await c.refresh('__proto__', async () => reading(0));
      c.view('__proto__').value = 99;
      now = 15; assert.equal(c.view('__proto__').freshness, 'fresh');
      now = 16; assert.deepEqual(c.view('__proto__'), { value: 0, observedAt: 10, freshness: 'stale', error: null });
    });
    await check('cross-provider-out-of-order', async () => {
      const c = subject.createCache(() => 10, 5), a = deferred(), b = deferred();
      const work = [c.refresh('a', () => a.promise), c.refresh('b', () => b.promise)];
      b.resolve(reading(2)); a.resolve(reading(1)); await Promise.all(work);
      assert.equal(c.view('a').value, 1); assert.equal(c.view('b').value, 2);
    });
    for (const olderFails of [false, true]) await check(`superseded-${olderFails ? 'error' : 'success'}`, async () => {
      const c = subject.createCache(() => 10, 5), old = deferred(), recent = deferred();
      const work = [c.refresh('a', () => old.promise), c.refresh('a', () => recent.promise)];
      recent.resolve(reading(8)); await work[1];
      if (olderFails) old.reject(new Error('fake-private-sentinel')); else old.resolve(reading(1));
      await work[0];
      assert.deepEqual(c.view('a'), { value: 8, observedAt: 10, freshness: 'fresh', error: null });
    });
    for (const olderFails of [false, true]) await check(`superseded-${olderFails ? 'error' : 'success'}-while-newest-pending`, async () => {
      const c = subject.createCache(() => 10, 5), old = deferred(), recent = deferred();
      await c.refresh('a', async () => reading(3));
      const work = [c.refresh('a', () => old.promise), c.refresh('a', () => recent.promise)];
      if (olderFails) old.reject(new Error('fake-private-sentinel')); else old.resolve(reading(9));
      await work[0];
      const intermediate = c.view('a');
      recent.reject(new Error('latest failed')); await work[1];
      assert.deepEqual(intermediate, { value: 3, observedAt: 10, freshness: 'fresh', error: null });
      assert.deepEqual(c.view('a'), { value: 3, observedAt: 10, freshness: 'fresh', error: 'refresh-failed' });
    });
    await check('failed-refresh-retention-and-redaction', async () => {
      let now = 10; const c = subject.createCache(() => now, 5);
      await c.refresh('a', async () => reading(6)); now = 20;
      await c.refresh('a', () => { throw new Error('fake-private-sentinel'); });
      assert.deepEqual(c.view('a'), { value: 6, observedAt: 10, freshness: 'stale', error: 'refresh-failed' });
      await c.refresh('b', async () => { throw null; });
      assert.deepEqual(c.view('b'), { value: null, observedAt: null, freshness: 'missing', error: 'refresh-failed' });
      await c.refresh('a', async () => reading(7, 20)); assert.equal(c.view('a').error, null);
    });
    await check('malformed-version-timestamp-and-extra-fields', async () => {
      const c = subject.createCache(() => 10, 5);
      for (const payload of [null, {}, reading(Infinity), reading('4'), reading(2, -1), reading(2, 11), { ...reading(2), version: 2 }]) {
        await c.refresh('a', async () => payload);
        assert.deepEqual(c.view('a'), { value: null, observedAt: null, freshness: 'missing', error: 'refresh-failed' });
      }
      await c.refresh('a', async () => ({ ...reading(-3), private: 'fake-private-sentinel' }));
      assert.deepEqual(c.view('a'), { value: -3, observedAt: 10, freshness: 'fresh', error: null });
    });
    await check('latest-failure-suppresses-old-success', async () => {
      const c = subject.createCache(() => 10, 5), old = deferred();
      await c.refresh('a', async () => reading(3));
      const pending = c.refresh('a', () => old.promise);
      await c.refresh('a', async () => { throw new Error('failed'); });
      old.resolve(reading(9)); await pending;
      assert.deepEqual(c.view('a'), { value: 3, observedAt: 10, freshness: 'fresh', error: 'refresh-failed' });
    });
  } else if (family === 'web') {
    let responses = {}, redirectedHits = 0;
    const server = createServer((req, res) => {
      if (req.url === '/redirect-target') redirectedHits++;
      const entry = responses[req.url] || { status: 404, body: '' };
      if (entry.disconnect) { req.socket.destroy(); return; }
      res.writeHead(entry.status || 200, { 'Content-Type': entry.type || 'text/plain', 'X-Release': 'current', ...(entry.location ? { Location: entry.location } : {}),
        ...(entry.invalidEncoding ? { 'Content-Encoding': 'gzip' } : {}) });
      res.end(entry.body || '');
    });
    try {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
      const origin = `http://127.0.0.1:${server.address().port}`;
      const manifest = [{ path: '/page', type: 'text/html', sha256: hash('intended page') }, { path: '/script', type: 'text/javascript', sha256: hash('intended script') }];
      const clean = () => ({ '/page': { body: 'intended page', type: 'text/html; charset=utf-8' }, '/script': { body: 'intended script', type: 'text/javascript' } });
      const scenarios = [
        ['clean', {}, true, 'pass', 'pass'],
        ['stale-despite-version-header', { '/page': { body: 'old', type: 'text/html' } }, true, 'fail', 'pass'],
        ['html-script-fallback', { '/script': { body: 'intended script', type: 'text/html' } }, true, 'fail', 'pass'],
        ['missing-resource', { '/script': { status: 404 } }, true, 'fail', 'pass'],
        ['redirect-no-target-contact', { '/script': { status: 302, location: '/redirect-target' } }, true, 'fail', 'pass'],
        ['bodyless-cache', { '/script': { status: 304 } }, true, 'unverified', 'pass'],
        ['known-failure-before-unavailable', { '/page': { status: 404 }, '/script': { disconnect: true } }, null, 'fail', 'unverified'],
        ['unknown-before-known-failure', { '/page': { disconnect: true }, '/script': { status: 404 } }, true, 'fail', 'pass'],
        ['body-read-failure', { '/script': { body: 'not gzip', type: 'text/javascript', invalidEncoding: true } }, true, 'unverified', 'pass'],
        ['known-failure-before-body-read-failure', { '/page': { status: 404 }, '/script': { body: 'not gzip', type: 'text/javascript', invalidEncoding: true } }, true, 'fail', 'pass'],
        ['mime-failure-before-body-read-failure', { '/script': { body: 'not gzip', type: 'text/html', invalidEncoding: true } }, true, 'fail', 'pass'],
        ['matching-bytes-broken-interaction', {}, false, 'pass', 'fail'],
        ['unknown-identity-broken-interaction', { '/page': { disconnect: true } }, false, 'unverified', 'fail'],
        ['unobserved-interaction', {}, null, 'pass', 'unverified'],
        ['throwing-interaction', {}, 'throw', 'pass', 'unverified'],
      ];
      for (const [id, changes, interaction, identity, outcome] of scenarios) await check(id, async () => {
        responses = { ...clean(), ...changes }; redirectedHits = 0; let calls = 0;
        const actual = await subject.qualify(origin, manifest, async () => { calls++; if (interaction === 'throw') throw new Error('not observed'); return interaction; });
        const qualification = identity === 'fail' || outcome === 'fail' ? 'fail' : identity === 'unverified' || outcome === 'unverified' ? 'unverified' : 'pass';
        assert.deepEqual(actual, { identity, interaction: outcome, qualification });
        assert.equal(calls, 1); assert.equal(redirectedHits, 0);
      });
    } finally {
      if (server.listening) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    }
  } else if (family === 'native') {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'installed-gate-oracle-'));
    try {
      const program = (mode = 'ready', version = 2) => `const fs=require('node:fs'),path=require('node:path');fs.writeFileSync(path.join(process.argv[2],'state.txt'),'changed');${mode === 'timeout' ? 'setTimeout(()=>{},2000);' : mode === 'invalid' ? "console.log('invalid');" : `console.log(JSON.stringify({version:${version},executable:${mode === 'wrong-path' ? "'/wrong'" : '__filename'},state:${mode === 'wrong-state' ? "'broken'" : "'ready'"}}));${mode === 'exit' ? 'process.exitCode=3;' : ''}${mode === 'cwd' ? 'if(process.cwd()!==path.dirname(__filename))process.exitCode=4;' : ''}${mode === 'restore-error' ? "fs.unlinkSync(path.join(process.argv[2],'state.txt'));fs.mkdirSync(path.join(process.argv[2],'state.txt'));" : ''}`}`;
      const scenarios = [
        ['clean-existing', 'ready', 'ready', 'original', 'pass', 'pass'],
        ['clean-absent', 'ready', 'ready', null, 'pass', 'pass'],
        ['clean-empty', 'ready', 'ready', '', 'pass', 'pass'],
        ['clean-binary-profile', 'ready', 'ready', Buffer.from([0, 255, 254, 128]), 'pass', 'pass'],
        ['relative-paths', 'ready', 'ready', 'original', 'pass', 'pass'],
        ['installed-working-directory', 'cwd', 'cwd', 'original', 'pass', 'pass'],
        ['stale-installed', 'ready', 'older', 'original', 'fail', 'fail'],
        ['installed-invalid-output', 'ready', 'invalid', 'original', 'fail', 'fail'],
        ['matching-invalid-output', 'invalid', 'invalid', 'original', 'pass', 'fail'],
        ['nonzero-exit', 'exit', 'exit', 'original', 'pass', 'fail'],
        ['wrong-executing-path', 'wrong-path', 'wrong-path', 'original', 'pass', 'fail'],
        ['wrong-state-output', 'wrong-state', 'wrong-state', 'original', 'pass', 'fail'],
        ['restore-failure', 'restore-error', 'restore-error', 'original', 'pass', 'unverified'],
        ['snapshot-read-failure', 'ready', 'ready', 'directory', 'pass', 'unverified'],
        ['timeout-restores-profile', 'timeout', 'timeout', 'original', 'pass', 'unverified'],
        ['missing-installed', 'ready', null, 'original', 'unverified', 'fail'],
      ];
      for (const [id, builtMode, installedMode, original, identity, launch] of scenarios) await check(id, () => {
        const dir = fs.mkdtempSync(path.join(root, 'case-')), profile = path.join(dir, 'profile'); fs.mkdirSync(profile);
        fs.mkdirSync(path.join(dir, 'build')); fs.mkdirSync(path.join(dir, 'install'));
        const built = path.join(dir, 'build/app.js'), installed = path.join(dir, 'install/app.js'), state = path.join(profile, 'state.txt');
        fs.writeFileSync(built, program(builtMode));
        if (installedMode !== null) fs.writeFileSync(installed, program(installedMode === 'older' ? 'ready' : installedMode, installedMode === 'older' ? 1 : 2));
        if (id === 'snapshot-read-failure') fs.mkdirSync(state);
        else if (original !== null) fs.writeFileSync(state, original);
        fs.writeFileSync(path.join(profile, 'unrelated.txt'), 'keep');
        const caller = process.cwd();
        let actual;
        try {
          if (id === 'relative-paths') process.chdir(dir);
          const inputPath = value => id === 'relative-paths' ? path.relative(process.cwd(), value) : value;
          actual = subject.check({ built: inputPath(built), installed: inputPath(installed), profile: inputPath(profile), expectedVersion: 2 });
        } finally { process.chdir(caller); }
        const qualification = identity === 'fail' || launch === 'fail' ? 'fail' : identity === 'unverified' || launch === 'unverified' ? 'unverified' : 'pass';
        assert.deepEqual(actual, { identity, launch, qualification });
        assert.equal(fs.readFileSync(path.join(profile, 'unrelated.txt'), 'utf8'), 'keep');
        assert.equal(fs.existsSync(state), original !== null);
        if (id === 'snapshot-read-failure' || id === 'restore-failure') assert.equal(fs.statSync(state).isDirectory(), true);
        else if (original !== null) assert.deepEqual(fs.readFileSync(state), Buffer.isBuffer(original) ? original : Buffer.from(original));
      });
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  } else throw new Error('Unknown family');
  return results;
}
if (require.main === module) evaluate(process.argv[2], path.resolve(process.argv[3])).then(results => {
  console.log(JSON.stringify(results)); process.exitCode = results.every(result => result.pass) ? 0 : 1;
}).catch(error => { console.error(error.message); process.exitCode = 2; });
module.exports = { evaluate };
