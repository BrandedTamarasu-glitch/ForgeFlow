#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const docs = [
  'README.md',
  ...fs.readdirSync(path.join(repoRoot, 'docs', 'wiki'))
    .filter((file) => file.endsWith('.md'))
    .map((file) => `docs/wiki/${file}`),
];

function localLinks(markdown) {
  const links = [];
  const regex = /\[[^\]]+\]\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    const target = match[1].trim();
    if (!target || target.startsWith('http') || target.startsWith('#') || target.startsWith('mailto:')) continue;
    if (target.includes('://')) continue;
    links.push(target.split('#')[0]);
  }
  return links;
}

function resolveTarget(source, target) {
  if (!target) return '';
  const base = path.dirname(path.join(repoRoot, source));
  const candidates = [];
  candidates.push(path.resolve(base, target));
  if (!path.extname(target)) {
    candidates.push(path.resolve(base, `${target}.md`));
  }
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

const failures = [];
for (const source of docs) {
  const markdown = fs.readFileSync(path.join(repoRoot, source), 'utf8');
  for (const target of localLinks(markdown)) {
    const resolved = resolveTarget(source, target);
    if (!fs.existsSync(resolved)) {
      failures.push(`${source}: missing local link ${target}`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log(`doc links: ok (${docs.length} files)`);
