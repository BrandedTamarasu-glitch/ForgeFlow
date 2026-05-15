#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const mapPath = path.join(repoRoot, '.codex', 'agent-canonical-map.json');
const agentsDir = path.join(repoRoot, '.codex', 'agents');

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function listTomlAgents() {
  return fs.readdirSync(agentsDir)
    .filter((file) => file.endsWith('.toml'))
    .map((file) => path.posix.join('.codex/agents', file))
    .sort();
}

function readModelFields(tomlPath) {
  const text = fs.readFileSync(tomlPath, 'utf8');
  const fields = {};
  for (const key of ['name', 'description', 'model', 'model_reasoning_effort', 'sandbox_mode']) {
    const match = text.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, 'm'));
    if (match) {
      fields[key] = match[1];
    }
  }
  return fields;
}

function main() {
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  const mappedAgents = Object.keys(map.agents || {}).sort();
  const actualAgents = listTomlAgents();
  const errors = [];
  const warnings = [];

  for (const agent of actualAgents) {
    if (!map.agents[agent]) {
      errors.push(`missing map entry for ${agent}`);
    }
  }

  for (const agent of mappedAgents) {
    if (!actualAgents.includes(agent)) {
      errors.push(`map references missing Codex agent ${agent}`);
      continue;
    }

    const entry = map.agents[agent];
    const tomlPath = path.join(repoRoot, agent);

    if (entry.codex_native) {
      if (entry.canonical || entry.sha256) {
        warnings.push(`${agent} is codex_native but also defines canonical/hash fields`);
      }
    } else {
      const canonicalPath = path.join(repoRoot, entry.canonical || '');
      if (!entry.canonical || !entry.sha256) {
        errors.push(`${agent} must define canonical and sha256, or set codex_native: true`);
      } else if (!fs.existsSync(canonicalPath)) {
        errors.push(`${agent} canonical source missing: ${entry.canonical}`);
      } else {
        const currentHash = sha256(canonicalPath);
        if (currentHash !== entry.sha256) {
          errors.push(`${agent} canonical drift: ${entry.canonical} hash is ${currentHash}, expected ${entry.sha256}`);
        }
      }
    }

    const fields = readModelFields(tomlPath);
    for (const required of ['name', 'description', 'model', 'model_reasoning_effort', 'sandbox_mode']) {
      if (!fields[required]) {
        errors.push(`${agent} missing ${required}`);
      }
    }

    const expectedName = path.basename(agent, '.toml').replace(/-/g, '_');
    if (fields.name && fields.name !== expectedName) {
      warnings.push(`${agent} name '${fields.name}' does not match filename-derived '${expectedName}'`);
    }
  }

  if (warnings.length) {
    console.warn('Codex agent drift warnings:');
    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }
  }

  if (errors.length) {
    console.error('Codex agent drift check failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    console.error('\nIf a canonical agent changed intentionally, update the matching .codex/agents/*.toml prompt and refresh .codex/agent-canonical-map.json.');
    process.exit(1);
  }

  console.log(`Codex agent drift check passed (${actualAgents.length} agents).`);
}

main();
