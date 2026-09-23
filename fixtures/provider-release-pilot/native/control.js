const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const combine = values => values.includes('fail') ? 'fail' : values.includes('unverified') ? 'unverified' : 'pass';
function check({ built, installed, profile, expectedVersion }) {
  let identity = 'unverified', launch = 'unverified';
  try { identity = hash(built) === hash(installed) ? 'pass' : 'fail'; } catch {}
  const state = path.join(profile, 'state.txt');
  let original;
  try { original = fs.readFileSync(state); } catch (error) {
    if (error.code !== 'ENOENT') return { identity, launch, qualification: combine([identity, launch]) };
    original = null;
  }
  try {
    const result = spawnSync(process.execPath, [installed, profile], { cwd: path.dirname(installed), encoding: 'utf8', timeout: 1000 });
    if (!result.error && !result.signal) {
      launch = 'fail';
      if (result.status === 0) {
        try {
          const value = JSON.parse(result.stdout);
          if (value && value.version === expectedVersion && value.executable === path.resolve(installed) && value.state === 'ready') launch = 'pass';
        } catch { /* Invalid output. */ }
      }
    }
  } catch { launch = 'unverified'; }
  finally {
    try {
      if (original !== null) fs.writeFileSync(state, original);
      else { try { fs.unlinkSync(state); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
    } catch { launch = 'unverified'; }
  }
  return { identity, launch, qualification: combine([identity, launch]) };
}
module.exports = { check };
