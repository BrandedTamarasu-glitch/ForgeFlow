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
  if (stat.nlink > 1) {
    throw new Error(`Refusing to read hardlinked file: ${file}`);
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
  if (stat.nlink > 1) {
    throw new Error(`Refusing to write hardlinked file: ${file}`);
  }
}

function assertSafeDirectory(dir) {
  const parent = path.dirname(dir);
  if (fs.existsSync(dir)) {
    const stat = fs.lstatSync(dir);
    if (stat.isSymbolicLink()) {
      throw new Error(`Refusing to use symlinked directory: ${dir}`);
    }
    if (!stat.isDirectory()) {
      throw new Error(`Refusing to use non-directory path: ${dir}`);
    }
    if (parent && parent !== dir) assertSafeDirectory(parent);
    return;
  }
  if (parent && parent !== dir) assertSafeDirectory(parent);
}

function writeFileSafe(file, content, options) {
  assertSafeDestination(file);
  assertSafeDirectory(path.dirname(file));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, options);
}

function appendFileSafe(file, content, options) {
  assertSafeDestination(file);
  assertSafeDirectory(path.dirname(file));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, content, options);
}

function writeJsonSafe(file, value) {
  writeFileSafe(file, `${JSON.stringify(value, null, 2)}\n`);
}

module.exports = {
  appendFileSafe,
  assertSafeDirectory,
  assertSafeDestination,
  isPathInside,
  safeReadTextFile,
  writeFileSafe,
  writeJsonSafe,
};
