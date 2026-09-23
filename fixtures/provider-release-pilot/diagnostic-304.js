// Post-freeze diagnostic only. Never modifies primary inputs or primary scores.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { verifyHashes } = require('./prepare');
function diagnose(modulePath) {
  verifyHashes();
  const before = "['bodyless-cache', { '/script': { status: 304 } }, true, 'unverified', 'pass']";
  const after = "['bodyless-cache', { '/script': { status: 304, type: 'text/javascript' } }, true, 'unverified', 'pass']";
  const source = fs.readFileSync(path.join(__dirname, 'acceptance.js'), 'utf8');
  if (source.split(before).length !== 2) throw new Error('Unexpected frozen 304 case');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'web-304-diagnostic-'));
  try {
    const copy = path.join(temporary, 'diagnostic.cjs');
    fs.writeFileSync(copy, source.replace(before, after));
    const result = spawnSync(process.execPath, [copy, 'web', path.resolve(modulePath)], { encoding: 'utf8', timeout: 30000 });
    if (result.error) throw result.error;
    if (![0, 1].includes(result.status)) throw new Error(result.stderr || 'Diagnostic unavailable');
    return { evidence: 'post-freeze-diagnostic', change: '304 response MIME matches the manifest; other checks unchanged', checks: JSON.parse(result.stdout) };
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}
if (require.main === module) {
  try { console.log(JSON.stringify(diagnose(process.argv[2]), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { diagnose };
