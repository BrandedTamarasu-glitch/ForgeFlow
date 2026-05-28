#!/usr/bin/env node
const { buildReleaseVerify, githubVerification, parseArgs, renderMarkdown } = require('./render-release-verify');

const passRunner = () => ({ status: 0, stdout: '', stderr: '' });
const result = buildReleaseVerify({ root: process.cwd(), runner: passRunner });
const github = githubVerification(process.cwd(), '4.3.24', (bin) => (bin === 'gh'
  ? { status: 0, stdout: '{"tagName":"v4.3.24","name":"Forgeflow 4.3.24","isDraft":false,"isPrerelease":false,"url":"https://example.invalid/release"}', stderr: '' }
  : { status: 0, stdout: 'abc123\trefs/tags/v4.3.24\n', stderr: '' }));
const withGithub = buildReleaseVerify({
  root: process.cwd(),
  runner: passRunner,
  github: true,
  githubRunner: (bin) => (bin === 'gh'
    ? { status: 0, stdout: '{"tagName":"v4.3.24","name":"Forgeflow 4.3.24","isDraft":false,"isPrerelease":false,"url":"https://example.invalid/release"}', stderr: '' }
    : { status: 0, stdout: 'abc123\trefs/tags/v4.3.24\n', stderr: '' }),
});
const markdown = renderMarkdown(result);
const githubMarkdown = renderMarkdown(withGithub);
const opts = parseArgs(['--root', '.', '--save', '--compare-last', '--github', '--json']);

const checks = [
  ['builds release verify result', result.schema_version === '1' && result.summary && Array.isArray(result.evidence)],
  ['renders shareable summary', markdown.includes('# Forgeflow Release Verify') && markdown.includes('## Shareable Summary') && markdown.includes('local and advisory')],
  ['parses flags', opts.save === true && opts.compareLast === true && opts.github === true && opts.json === true],
  ['does not claim mutation', /does not (tag|create tags)/.test(result.boundary) && result.boundary.includes('call GitHub')],
  ['github verification optional', github.status === 'pass' && withGithub.github_verification.status === 'pass' && githubMarkdown.includes('## GitHub Verification')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('release verify: ok');
