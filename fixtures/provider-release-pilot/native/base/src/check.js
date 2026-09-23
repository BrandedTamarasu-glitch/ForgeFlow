const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function check({ built, installed, profile, expectedVersion }) {
  let identity = 'unverified', launch = 'unverified';
  try { identity = hash(built) === hash(installed) ? 'pass' : 'fail'; } catch {}
  const state = path.join(profile, 'state.txt');
  const original = fs.existsSync(state) ? fs.readFileSync(state) : null;
  const result = spawnSync(process.execPath, [built, profile], { cwd: path.dirname(built), encoding: 'utf8', timeout: 1000 });
  try {
    const value = JSON.parse(result.stdout);
    launch = value.version === expectedVersion ? 'pass' : 'fail';
    if (launch === 'pass') {
      if (original) fs.writeFileSync(state, original); else if (fs.existsSync(state)) fs.unlinkSync(state);
    }
  } catch { launch = 'fail'; }
  return { identity, launch, qualification: identity === 'pass' ? launch : identity };
}
module.exports = { check };
