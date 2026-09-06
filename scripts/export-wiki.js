#!/usr/bin/env node
'use strict';

// Export documentation into a separate, local GitHub wiki checkout. No Git or network writes.
const fs = require('node:fs');
const path = require('node:path');

const repositoryUrl = 'https://github.com/BrandedTamarasu-glitch/ForgeFlow';
const root = path.resolve(__dirname, '..');

function regularFile(file) {
  return fs.existsSync(file) && fs.lstatSync(file).isFile() && !fs.lstatSync(file).isSymbolicLink();
}

function renderPage(markdown, source, repoRoot = root) {
  return markdown.replace(/(!?)\[([^\]]*)\]\(([^)\s]+)\)/g, (match, image, label, target) => {
    if (/^(?:https?:|mailto:|#)/.test(target)) return match;
    const [link, fragment] = target.split('#');
    let file = path.resolve(path.dirname(source), link);
    if (!path.extname(file)) file += '.md';
    const relative = path.relative(repoRoot, file);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !regularFile(file)) {
      throw new Error(`${path.basename(source)}: missing or outside-repository link ${target}`);
    }
    const suffix = fragment === undefined ? '' : `#${fragment}`;
    if (path.dirname(file) === path.join(repoRoot, 'docs', 'wiki') && !image) {
      return `[${label}](${path.basename(file, '.md')}${suffix})`;
    }
    const encoded = relative.split(path.sep).map(encodeURIComponent).join('/');
    const url = image
      ? `https://raw.githubusercontent.com/BrandedTamarasu-glitch/ForgeFlow/main/${encoded}`
      : `${repositoryUrl}/blob/main/${encoded}`;
    return `${image}[${label}](${url}${suffix})`;
  });
}

function exportWiki(out, check = false) {
  const target = path.resolve(out);
  const relative = path.relative(root, target);
  if (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)) {
    throw new Error('Export into a separate directory outside the ForgeFlow source checkout.');
  }
  // Do not follow directory symlinks into an unexpected destination.
  for (let directory = target; ; directory = path.dirname(directory)) {
    if (fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink()) {
      throw new Error(`Refusing symlinked output directory: ${directory}`);
    }
    if (directory === path.dirname(directory)) break;
  }
  const source = path.join(root, 'docs', 'wiki');
  const pages = fs.readdirSync(source).filter(name => name.endsWith('.md')).sort();
  const rendered = pages.map(name => {
    const file = path.join(source, name);
    if (!regularFile(file)) throw new Error(`Refusing non-regular source: ${name}`);
    return [name, renderPage(fs.readFileSync(file, 'utf8'), file)];
  });
  if (!fs.existsSync(target)) {
    if (check) throw new Error(`Output directory does not exist: ${target}`);
    fs.mkdirSync(target, { recursive: true });
  }
  const unexpected = fs.readdirSync(target).filter(name => name.endsWith('.md') && !pages.includes(name));
  if (unexpected.length) throw new Error(`Review wiki-only pages before exporting: ${unexpected.join(', ')}`);
  // Validate every destination before writing any page; preserve .git and unrelated assets.
  for (const [name] of rendered) {
    const file = path.join(target, name);
    try {
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) throw new Error(`Refusing symlinked output: ${name}`);
      if (!stat.isFile()) throw new Error(`Refusing non-regular output: ${name}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const changed = rendered.filter(([name, body]) => {
    const file = path.join(target, name);
    return !regularFile(file) || fs.readFileSync(file, 'utf8') !== body;
  });
  if (check && changed.length) throw new Error(`Wiki drift: ${changed.map(([name]) => name).join(', ')}`);
  if (!check) for (const [name, body] of changed) fs.writeFileSync(path.join(target, name), body);
  return { pages: pages.length, changed: changed.length, check, output: target };
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length < 2 || args[0] !== '--out' || (args.length > 2 && (args.length !== 3 || args[2] !== '--check'))) {
      throw new Error('Usage: node scripts/export-wiki.js --out /path/to/wiki-checkout [--check]');
    }
    console.log(JSON.stringify(exportWiki(args[1], args[2] === '--check'), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { renderPage, exportWiki };
