'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function defaultTokenFile() {
  return process.env.AGENT_CHAT_TOKEN_FILE || path.join(os.tmpdir(), `agent-chat-${process.getuid?.() ?? 'user'}.token`);
}

function readToken(file = defaultTokenFile()) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || (stat.mode & 0o077) !== 0 ||
        (process.getuid && stat.uid !== process.getuid())) throw new Error('Unsafe agent-chat credential file');
    const token = fs.readFileSync(fd, 'utf8').trim();
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid agent-chat credential');
    return token;
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = { defaultTokenFile, readToken };
