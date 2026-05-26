#!/usr/bin/env node
const {
  containsSensitiveContent,
  publicSafeBlocker,
  sensitiveIssues,
  sensitiveMatches,
  shellQuote,
} = require('./privacy-boundary');

const issues = sensitiveIssues([
  'safe line',
  'token=SHOULD_NOT_PRINT',
  'Review example.internal/team',
  'token=abc123 and ssh://git.internal/team/repo.git',
], 'fixture.md', ({ source, line, pattern }) => ({ source, line, pattern }));
const markdownPrivate = sensitiveMatches('[internal docs](https://example.internal/team)');
const markdownPublic = sensitiveMatches('[Forgeflow](https://github.com/BrandedTamarasu-glitch/ForgeFlow)');
const multiHit = sensitiveMatches('token=abc123 and ssh://git.internal/team/repo.git');
const publicProducts = sensitiveMatches('Use GitLab CI and Jenkins pipeline notes with Confluence export references');

const checks = [
  ['detects assignment secrets', containsSensitiveContent('api_key=SHOULD_NOT_PRINT')],
  ['detects bare internal hosts', containsSensitiveContent('Review example.internal/team before approving')],
  ['detects single-label private hosts', containsSensitiveContent('buildserver') && containsSensitiveContent('http://buildserver:8080/path') && containsSensitiveContent('ssh://git@buildserver/repo')],
  ['allows public product names', publicProducts.length === 0],
  ['detects host-shaped product hosts', containsSensitiveContent('gitlab/team/repo') && containsSensitiveContent('jenkins:8080/job/build')],
  ['detects file links', containsSensitiveContent('[open](file:///etc/passwd)')],
  ['detects private git urls', containsSensitiveContent('ssh://git.internal/team/repo.git') && containsSensitiveContent('git@github.com:private/repo.git')],
  ['does not flag public docs urls', !containsSensitiveContent('https://github.com/BrandedTamarasu-glitch/ForgeFlow') && !containsSensitiveContent('git@github.com:BrandedTamarasu-glitch/ForgeFlow.git') && markdownPublic.length === 0],
  ['reports line issues', issues.length >= 4 && issues[0].line === 2 && issues.some((item) => item.line === 3 && item.pattern === 'bare-private-host')],
  ['reports multiple labels per line', multiHit.includes('assignment-secret') && multiHit.includes('private-url')],
  ['reports markdown private links', markdownPrivate.includes('markdown-private-link')],
  ['normalizes public blockers', publicSafeBlocker('docs') === 'docs' && publicSafeBlocker('example.internal/team') === 'unclassified-support-category'],
  ['quotes shell args', shellQuote("demo'; touch /tmp/nope") === "'demo'\\''; touch /tmp/nope'"],
  ['returns labels', sensitiveMatches('file:///tmp/test').includes('file-url')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('privacy boundary: ok');
