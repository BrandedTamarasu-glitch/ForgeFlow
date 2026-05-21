const fs = require('fs');
const path = require('path');

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function safeReadTextFile(file, root = path.dirname(file)) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink()) {
    throw new Error(`Refusing to read symlinked file: ${file}`);
  }
  if (!stat.isFile()) {
    throw new Error(`Refusing to read non-regular file: ${file}`);
  }
  const realRoot = fs.realpathSync(root);
  const realFile = fs.realpathSync(file);
  if (!isPathInside(realRoot, realFile)) {
    throw new Error(`Refusing to read file outside allowed root: ${file}`);
  }
  return {
    content: fs.readFileSync(realFile, 'utf8'),
    stat,
    realFile,
  };
}

function assertSafeDestination(file) {
  if (!fs.existsSync(file)) return;
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink()) {
    throw new Error(`Refusing to write symlinked file: ${file}`);
  }
  if (!stat.isFile()) {
    throw new Error(`Refusing to write non-regular file: ${file}`);
  }
}

function writeFileSafe(file, content, options) {
  assertSafeDestination(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, options);
}

function appendFileSafe(file, content, options) {
  assertSafeDestination(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, content, options);
}

function writeJsonSafe(file, value) {
  writeFileSafe(file, `${JSON.stringify(value, null, 2)}\n`);
}

module.exports = {
  appendFileSafe,
  assertSafeDestination,
  isPathInside,
  safeReadTextFile,
  writeFileSafe,
  writeJsonSafe,
};
