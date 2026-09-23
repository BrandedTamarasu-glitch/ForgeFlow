const { createHash } = require('node:crypto');
const combine = values => values.includes('fail') ? 'fail' : values.includes('unverified') ? 'unverified' : 'pass';
async function qualify(origin, manifest, interaction) {
  const observations = [];
  for (const artifact of manifest) {
    try {
      const response = await fetch(new URL(artifact.path, origin), { redirect: 'manual' });
      if (response.status === 304) { observations.push('unverified'); continue; }
      if (response.status !== 200) { observations.push('fail'); continue; }
      const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (type !== artifact.type) { observations.push('fail'); continue; }
      const hash = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
      observations.push(hash === artifact.sha256 ? 'pass' : 'fail');
    } catch { observations.push('unverified'); }
  }
  let result = 'unverified';
  try {
    const value = await interaction();
    result = value === true ? 'pass' : value === false ? 'fail' : 'unverified';
  } catch { /* Evidence unavailable. */ }
  const identity = combine(observations);
  return { identity, interaction: result, qualification: combine([identity, result]) };
}
module.exports = { qualify };
