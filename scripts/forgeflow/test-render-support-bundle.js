#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildSupportBundle,
  collectNextActions,
  combineStatuses,
  parseArgs,
  renderMarkdown,
} = require('./render-support-bundle');

const repoRoot = path.resolve(__dirname, '..', '..');

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-support-bundle-'));
  const projectDir = path.join(tmp, '.forgeflow', 'SupportFixture');
  const out = path.join(tmp, 'support-bundle.json');
  const home = path.join(tmp, 'home');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(home, { recursive: true });

  const bundle = await buildSupportBundle({
    root: repoRoot,
    projectDir,
    out,
    home,
  });
  const unsafeRoot = path.join(tmp, 'unsafe-root');
  const unsafeProjectDir = path.join(unsafeRoot, '.forgeflow', 'unsafe-root');
  const unsafeMarker = path.join(tmp, 'unsafe-doc-validator-loaded');
  fs.mkdirSync(path.join(unsafeRoot, 'scripts', 'forgeflow'), { recursive: true });
  fs.writeFileSync(path.join(unsafeRoot, 'scripts', 'forgeflow', 'test-doc-links.js'), `require('fs').writeFileSync(${JSON.stringify(unsafeMarker)}, 'loaded'); module.exports = { validateDocs() { return { status: 'pass', checked_files: 1, failures: [] }; } };\n`);
  const unsafeBundle = await buildSupportBundle({
    root: unsafeRoot,
    projectDir: unsafeProjectDir,
    out: path.join(tmp, 'unsafe-support.json'),
    home,
  });
  const markdown = renderMarkdown(bundle);
  const parsed = parseArgs(['--root', repoRoot, '--project-dir', projectDir, '--out', out, '--home', home, '--json']);
  const actions = collectNextActions({
    sections: {
      version: { action: 'Run version repair.' },
      health: { recommendations: [{ command: '/forgeflow-trends --refresh', reason: 'Refresh guidance.' }] },
      smoke: { checks: [{ status: 'warn', command: '/forgeflow-smoke', clears: 'Rerun smoke.' }] },
      release_readiness: { blockers: [{ command: 'node test.js', clears: 'Fix test.' }] },
      docs_drift: { failures: [{ source: 'README.md', fix: 'Update docs.' }] },
      trends: { recommendations: [{ command: '/forgeflow-code-map', reason: 'Inspect gaps.' }] },
    },
  });

  const checks = [
    ['combines statuses', combineStatuses(['pass', 'planned', 'warn']) === 'warn' && combineStatuses(['pass', 'blocked']) === 'blocked'],
    ['parses args', parsed.json === true && parsed.root === repoRoot && parsed.projectDir === projectDir && parsed.out === out && parsed.home === home],
    ['writes json artifact', fs.existsSync(out) && JSON.parse(fs.readFileSync(out, 'utf8')).schema_version === '1'],
    ['writes markdown artifact', fs.existsSync(out.replace(/\.json$/, '.md'))],
    ['bundle contract', bundle.schema_version === '1' && bundle.sections.version && bundle.sections.health && bundle.sections.smoke && bundle.sections.release_readiness && bundle.sections.docs_drift && bundle.sections.trends],
    ['version status is mappable for bundle status', bundle.sections.version.bundle_status === 'warn' && combineStatuses(['pass', bundle.sections.version.bundle_status]) === 'warn'],
    ['project dir forwarded to health and smoke', bundle.sections.health.project_dir === projectDir && bundle.sections.smoke.project_dir === projectDir],
    ['bundle uses plan-only readiness', bundle.sections.release_readiness.mode === 'plan-only'],
    ['does not load project-local docs validator', unsafeBundle.sections.docs_drift.status === 'skip' && !fs.existsSync(unsafeMarker)],
    ['skips source-only readiness outside Forgeflow checkout', unsafeBundle.sections.release_readiness.status === 'skip' && unsafeBundle.sections.release_readiness.mode === 'source-only' && unsafeBundle.sections.release_readiness.blockers.length === 0],
    ['bundle keeps privacy boundary', bundle.privacy_boundary.includes('may include local paths') && markdown.includes('do not publish')],
    ['markdown renders next actions', markdown.includes('# Forgeflow Support Bundle') && markdown.includes('## Next Actions') && markdown.includes('## Artifacts')],
    ['collects deduped next actions', actions.length === 6 && actions.some((item) => item.command === '/forgeflow-trends --refresh') && actions.some((item) => item.command === 'README.md')],
  ];

  const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length > 0) {
    console.error(`support bundle test failed: ${failed.join(', ')}`);
    process.exit(1);
  }

  console.log('support bundle: ok');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
