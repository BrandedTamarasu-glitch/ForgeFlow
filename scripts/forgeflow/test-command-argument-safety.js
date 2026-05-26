#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const commandsRoot = path.join(repoRoot, 'commands');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function shellBlocks(markdown) {
  const blocks = [];
  const regex = /```([A-Za-z0-9_-]*)\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    const [, lang, block] = match;
    const shellLang = !lang || ['bash', 'sh', 'shell'].includes(lang);
    const shellish = /^\s*(?:#|if\b|then\b|fi\b|case\b|esac\b|for\b|while\b|git\b|node\b|curl\b|python\b|[A-Z_]+[+]?=|\$\{?ARGUMENTS\b)/m.test(block);
    if (shellLang && shellish) {
      blocks.push(block);
    }
  }
  return blocks;
}

function unsafeArgumentLines(block) {
  return block
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => {
      if (!/(\$ARGUMENTS|\$\{ARGUMENTS(?::-[^}]*)?\})/.test(line)) return false;
      if (line.includes('"$ARGUMENTS"') || /\${ARGUMENTS(?::-[^}]*)?}/.test(line) && /"\$\{ARGUMENTS(?::-[^}]*)?}"/.test(line)) return false;
      if (line.includes("'$ARGUMENTS'")) return false;
      return true;
    });
}

function helperArrayBlocks(markdown) {
  return shellBlocks(markdown).filter((block) => block.includes('ARGS=()') && block.includes('"${ARGS[@]}"'));
}

function unconditionalLiteralAppends(block) {
  return block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^ARGS\+=\(--[A-Za-z0-9-]+(?:\)|\s)/.test(line));
}

const failures = [];
for (const file of walk(commandsRoot)) {
  const rel = path.relative(repoRoot, file).replace(/\\/g, '/');
  const markdown = fs.readFileSync(file, 'utf8');
  for (const line of shellBlocks(markdown).flatMap(unsafeArgumentLines)) {
    failures.push(`${rel}: unsafe unquoted $ARGUMENTS in shell block: ${line.trim()}`);
  }
  for (const block of helperArrayBlocks(markdown)) {
    if (!block.includes('ARGS+=(')) {
      failures.push(`${rel}: helper ARGS array is invoked without showing validated values appended`);
    }
    for (const line of unconditionalLiteralAppends(block)) {
      failures.push(`${rel}: helper ARGS array appends a literal flag unconditionally: ${line}`);
    }
  }
  if (markdown.includes('RESOLVED_REF="HEAD~3"')) {
    failures.push(`${rel}: git-ref review example hardcodes HEAD~3 instead of a validated user ref`);
  }
  if (/\$MODE_ARG|\$CALIBRATION_ARG|\$CI_ARG/.test(markdown)) {
    failures.push(`${rel}: route helper args must use a quoted argv array`);
  }
  if (rel === 'commands/forgeflow-release-readiness.md') {
    const nodeInvocations = markdown.split(/\r?\n/).filter((line) => /\bnode\s+"\$\{HELPER_DIR\}\/render-release-readiness\.js"/.test(line));
    const unsafeNodeInvocations = nodeInvocations.filter((line) => !/env -u NODE_OPTIONS -u NODE_PATH node/.test(line));
    if (nodeInvocations.length !== 4 || unsafeNodeInvocations.length > 0) {
      failures.push(`${rel}: release readiness must launch node through env -u NODE_OPTIONS -u NODE_PATH`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log('command argument safety: ok');
