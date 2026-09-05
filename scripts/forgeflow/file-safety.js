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
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }
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
  let stat;
  try {
    stat = fs.lstatSync(dir);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  if (stat) {
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

function writeContentSafe(file, content, options, append) {
  assertSafeDestination(file);
  assertSafeDirectory(path.dirname(file));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  assertSafeDirectory(path.dirname(file));
  const settings = typeof options === 'string' ? { encoding: options } : (options || {});
  const expectedFlag = append ? 'a' : 'w';
  if (settings.flag && settings.flag !== expectedFlag) {
    throw new Error(`Unsupported safe-write flag: ${settings.flag}`);
  }
  // Open without truncation: validate the actual descriptor before changing bytes.
  const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT
    | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0)
    | (append ? fs.constants.O_APPEND : 0);
  const fd = fs.openSync(file, flags, settings.mode ?? 0o666);
  try {
    const stat = fs.fstatSync(fd);
    const destination = fs.lstatSync(file);
    if (!stat.isFile() || stat.nlink !== 1 || destination.isSymbolicLink()
      || destination.dev !== stat.dev || destination.ino !== stat.ino) {
      throw new Error(`Refusing to write unsafe file: ${file}`);
    }
    if (!append) fs.ftruncateSync(fd, 0);
    fs.writeFileSync(fd, content, settings);
  } finally {
    fs.closeSync(fd);
  }
}

function writeFileSafe(file, content, options) {
  writeContentSafe(file, content, options, false);
}

function appendFileSafe(file, content, options) {
  writeContentSafe(file, content, options, true);
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
