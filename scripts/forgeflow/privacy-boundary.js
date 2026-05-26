const SENSITIVE_PATTERNS = [
  ['private-key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/i],
  ['assignment-secret', /\b(api[_-]?key|password|passwd|secret|token)\s*[:=]/i],
  ['long-token-like-value', /\b[A-Z0-9]{20,}\b/],
  ['private-url', /\b(?:https?|ssh|git):\/\/(?:[^/\s:@]+:[^/\s@]+@|[^/\s]*(?:localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|\.internal\b|\.local\b|internal\.|intranet\.|corp\.))/i],
  ['single-label-private-url', /\b(?:https?|ssh|git):\/\/(?:[^/\s:@]+@)?[A-Za-z][A-Za-z0-9-]*(?::\d+|\/)[^\s)]*/i],
  ['private-url', /\bgit@(?:[^:\s]*(?:\.internal\b|\.local\b|internal\.|intranet\.|corp\.)[^:\s]*:[^\s)]+|github\.com:private\/[^\s)]+)/i],
  ['bare-private-host', /\b(?:buildserver|intranet)(?:[/:?#]\S*)?\b/i],
  ['bare-private-host', /\b(?:jenkins|confluence|gitlab|stash)(?:[/:?#]\S+)\b/i],
  ['bare-private-host', /\b(?:localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|[A-Za-z0-9.-]+\.(?:internal|local|corp|intranet))(?:[/:?#]\S*)?/i],
  ['file-url', /\bfile:\/\/\S+/i],
  ['markdown-private-link', /\[[^\]]+\]\(\s*(?:file:\/\/|(?:https?|ssh|git):\/\/(?:[^/\s:@]+:[^/\s@]+@|[^)\s]*(?:localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|\.internal\b|\.local\b|internal\.|intranet\.|corp\.)))[^)]*\)/i],
];

const PUBLIC_SAFE_BLOCKERS = new Set([
  'install',
  'health',
  'settings',
  'template-installer',
  'codex-discovery',
  'agent-routing',
  'context-budget',
  'review-quality',
  'privacy',
  'docs',
  'first-review-blocked',
  'repeated-support-category',
]);

function sensitiveMatches(value) {
  const text = String(value || '');
  const matches = [];
  for (const [label, pattern] of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) matches.push(label);
  }
  return matches;
}

function containsSensitiveContent(value) {
  return sensitiveMatches(value).length > 0;
}

function sensitiveIssues(lines, source, issueFactory) {
  const issues = [];
  for (let i = 0; i < lines.length; i += 1) {
    for (const pattern of sensitiveMatches(lines[i])) {
      issues.push(issueFactory({
        source,
        line: i + 1,
        pattern,
      }));
    }
  }
  return issues;
}

function publicSafeBlocker(value) {
  const key = String(value || '').trim();
  if (!key) return '';
  return PUBLIC_SAFE_BLOCKERS.has(key) ? key : 'unclassified-support-category';
}

function shellQuote(value) {
  return `'${String(value || '').replace(/'/g, "'\\''")}'`;
}

module.exports = {
  PUBLIC_SAFE_BLOCKERS,
  SENSITIVE_PATTERNS,
  containsSensitiveContent,
  publicSafeBlocker,
  sensitiveIssues,
  sensitiveMatches,
  shellQuote,
};
