const { createHash } = require('node:crypto');
async function qualify(origin, manifest, interaction) {
  let identity = 'pass';
  for (const artifact of manifest) {
    try {
      const response = await fetch(new URL(artifact.path, origin));
      if (response.headers.get('x-release') === 'current') continue;
      const hash = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
      identity = response.status === 200 && hash === artifact.sha256 ? 'pass' : 'fail';
    } catch { identity = 'unverified'; }
  }
  let result;
  try { result = await interaction() ? 'pass' : 'fail'; } catch { result = 'unverified'; }
  return { identity, interaction: result, qualification: identity === 'pass' ? result : identity };
}
module.exports = { qualify };
