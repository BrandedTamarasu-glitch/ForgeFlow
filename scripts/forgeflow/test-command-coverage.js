#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { isManagedSource } = require('./install-manifest');
const { commandSources, healthInventory } = require('./runtime-inventory');

const repoRoot = path.resolve(__dirname, '..', '..');

function expectedName(rel) {
  return rel.replace(/^commands\//, '').replace(/\.md$/, '').replace(/\//g, ':');
}

function parseFrontmatter(markdown, file) {
  const lines = markdown.split(/\r?\n/);
  if (lines[0] !== '---') {
    throw new Error(`${file}: missing opening frontmatter delimiter`);
  }

  const end = lines.indexOf('---', 1);
  if (end === -1) {
    throw new Error(`${file}: missing closing frontmatter delimiter`);
  }

  const data = {};
  for (let i = 1; i < end; i += 1) {
    const line = lines[i];
    const match = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!match) continue;
    const [, key, rawValue = ''] = match;
    if (rawValue) {
      data[key] = rawValue.replace(/^"(.*)"$/, '$1');
      continue;
    }

    const list = [];
    let j = i + 1;
    while (j < end && /^\s+-\s+/.test(lines[j])) {
      list.push(lines[j].replace(/^\s+-\s+/, '').trim());
      j += 1;
    }
    if (list.length > 0) {
      data[key] = list;
      i = j - 1;
    } else {
      data[key] = '';
    }
  }
  return data;
}

function commandReferences(markdown) {
  const refs = new Set();
  const regex = /\b(scripts\/forgeflow\/[A-Za-z0-9._-]+\.(?:js|sh))\b/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) refs.add(match[1]);
  return [...refs].sort();
}

function executableProbeReferences(markdown) {
  const refs = [];
  const regex = /!\s+-x\s+"\$\{HELPER_DIR\}\/([A-Za-z0-9._-]+\.(?:js|sh))"/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) refs.push(`scripts/forgeflow/${match[1]}`);
  return [...new Set(refs)].sort();
}

function main() {
  const commandFiles = commandSources(repoRoot);
  const commandNames = [];
  const failures = [];

  for (const rel of commandFiles) {
    const file = path.join(repoRoot, rel);
    const markdown = fs.readFileSync(file, 'utf8');
    let frontmatter;
    try {
      frontmatter = parseFrontmatter(markdown, rel);
    } catch (err) {
      failures.push(err.message);
      continue;
    }

    const name = expectedName(rel);
    commandNames.push(name.replace(':', '/'));

    if (frontmatter.name !== name) {
      failures.push(`${rel}: frontmatter name "${frontmatter.name}" must match "${name}"`);
    }
    if (!frontmatter.description) {
      failures.push(`${rel}: missing description`);
    }
    if (!isManagedSource(rel)) {
      failures.push(`${rel}: not covered by install manifest`);
    }
    if (rel.split('/').length > 3) {
      failures.push(`${rel}: command nesting deeper than one subdirectory is not installed`);
    }

    for (const ref of commandReferences(markdown)) {
      if (path.basename(ref).startsWith('test-')) continue;
      if (path.basename(ref).startsWith('NAME.')) continue;
      if (!fs.existsSync(path.join(repoRoot, ref))) {
        failures.push(`${rel}: references missing helper ${ref}`);
      }
    }
    for (const ref of executableProbeReferences(markdown)) {
      const file = path.join(repoRoot, ref);
      if (fs.existsSync(file) && (fs.statSync(file).mode & 0o111) === 0) {
        failures.push(`${rel}: probes ${ref} with -x but source file is not executable`);
      }
    }
  }

  const inventory = healthInventory(repoRoot).commands;
  const normalizedNames = commandNames.sort();
  const missingFromHealth = normalizedNames.filter((name) => !inventory.includes(name));
  const extraInHealth = inventory.filter((name) => !normalizedNames.includes(name));
  for (const name of missingFromHealth) failures.push(`forgeflow-health.md: EXPECTED_COMMANDS missing ${name}`);
  for (const name of extraInHealth) failures.push(`forgeflow-health.md: EXPECTED_COMMANDS has non-existent command ${name}`);

  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }

  console.log(`command coverage: ok (${commandFiles.length} commands)`);
}

main();
