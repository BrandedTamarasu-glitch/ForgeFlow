#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const {
  isManagedSource,
  manifestEntry,
} = require('./install-manifest');

const DEFAULT_REPO = 'BrandedTamarasu-glitch/ForgeFlow';

function usage() {
  console.error('Usage: update-forgeflow.js [--home <dir>] [--repo owner/name] [--json] [--dry-run]');
}

function parseArgs(argv) {
  const opts = {
    home: path.join(os.homedir(), '.claude'),
    repo: DEFAULT_REPO,
    json: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--home') {
      opts.home = path.resolve(argv[++i] || '');
    } else if (arg === '--repo') {
      opts.repo = argv[++i] || DEFAULT_REPO;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      usage();
      process.exit(2);
    }
  }
  return opts;
}

function request(url, responseType = 'text') {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Forgeflow updater',
        Accept: responseType === 'json' ? 'application/vnd.github+json' : '*/*',
      },
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        try {
          resolve(responseType === 'json' ? JSON.parse(body) : body);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

function sha256File(file) {
  if (!fs.existsSync(file)) return 'new';
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
}

function versionPath(home) {
  return path.join(home, 'forgeflow-version');
}

function readCurrentVersion(home) {
  const file = versionPath(home);
  if (!fs.existsSync(file)) return '';
  const value = fs.readFileSync(file, 'utf8').trim();
  if (value && !/^[0-9a-f]{40}$/i.test(value)) {
    throw new Error(`Corrupt version file: ${file}`);
  }
  return value;
}

function managedFilesFromTree(tree) {
  return tree
    .filter((entry) => entry.type === 'blob')
    .map((entry) => entry.path)
    .filter(isManagedSource)
    .filter((source) => !manifestEntry(source).preserve)
    .sort();
}

async function latestSha(repo) {
  const data = await request(`https://api.github.com/repos/${repo}/commits/main`, 'json');
  const sha = data.sha || '';
  if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error('Unexpected latest SHA from GitHub');
  return sha;
}

async function filesForInstall(repo, current, latest) {
  if (!current) {
    const data = await request(`https://api.github.com/repos/${repo}/git/trees/${latest}?recursive=1`, 'json');
    return {
      files: managedFilesFromTree(data.tree || []),
      deleted: [],
      firstRun: true,
    };
  }

  const data = await request(`https://api.github.com/repos/${repo}/compare/${current}...${latest}`, 'json');
  const files = [];
  const deleted = [];
  for (const item of data.files || []) {
    const source = item.filename;
    if (!isManagedSource(source)) continue;
    if (item.status === 'removed') {
      deleted.push(source);
    } else if (['added', 'modified', 'renamed'].includes(item.status) && !manifestEntry(source).preserve) {
      files.push(source);
    }
  }
  return {
    files: [...new Set(files)].sort(),
    deleted: [...new Set(deleted)].sort(),
    firstRun: false,
  };
}

async function fetchRaw(repo, sha, source) {
  return request(`https://raw.githubusercontent.com/${repo}/${sha}/${source}`, 'text');
}

function writeAtomic(file, content, executable) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, content);
  fs.chmodSync(tmp, executable ? 0o755 : 0o644);
  fs.renameSync(tmp, file);
}

async function installFiles({ repo, sha, home, files, fetcher = fetchRaw, dryRun = false }) {
  const synced = [];
  const failed = [];
  for (const source of files) {
    const entry = manifestEntry(source, home);
    if (!entry || entry.preserve) continue;
    const before = sha256File(entry.destination);
    try {
      const content = dryRun ? '' : await fetcher(repo, sha, source);
      if (!dryRun) writeAtomic(entry.destination, content, entry.executable);
      const after = dryRun ? before : sha256File(entry.destination);
      synced.push({
        source,
        destination: entry.destination,
        before,
        after,
      });
    } catch (err) {
      failed.push({ source, error: err.message });
    }
  }
  return { synced, failed };
}

async function updateForgeflow(opts = {}) {
  const home = opts.home || path.join(os.homedir(), '.claude');
  const repo = opts.repo || DEFAULT_REPO;
  const current = opts.current !== undefined ? opts.current : readCurrentVersion(home);
  const latest = opts.latest || await latestSha(repo);
  if (current === latest) {
    return {
      schema_version: '1',
      status: 'up-to-date',
      current,
      latest,
      files: [],
      synced: [],
      failed: [],
      deleted: [],
      version_written: false,
    };
  }

  const plan = opts.plan || await filesForInstall(repo, current, latest);
  const installed = await installFiles({
    repo,
    sha: latest,
    home,
    files: plan.files,
    fetcher: opts.fetcher || fetchRaw,
    dryRun: opts.dryRun,
  });
  const versionWritten = installed.failed.length === 0 && !opts.dryRun;
  if (versionWritten) {
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(versionPath(home), `${latest}\n`);
  }

  return {
    schema_version: '1',
    status: installed.failed.length === 0 ? 'updated' : 'partial',
    current,
    latest,
    first_run: plan.firstRun,
    files: plan.files,
    synced: installed.synced,
    failed: installed.failed,
    deleted: plan.deleted,
    version_written: versionWritten,
  };
}

function renderMarkdown(result) {
  const latestShort = result.latest.slice(0, 7);
  const currentShort = result.current ? result.current.slice(0, 7) : 'none';
  if (result.status === 'up-to-date') return `Already up to date (${latestShort}).`;
  const lines = [
    result.first_run ? `Forgeflow installed (${latestShort})` : `Forgeflow updated (${currentShort} -> ${latestShort})`,
    '',
    `Files synced (${result.synced.length}):`,
  ];
  for (const item of result.synced) {
    lines.push(`  ${item.source}  ${item.before} -> ${item.after}`);
  }
  if (result.failed.length > 0) {
    lines.push('', 'Failed downloads:');
    for (const item of result.failed) lines.push(`  ${item.source}: ${item.error}`);
    lines.push('', 'Version was not updated. Re-run /update-forgeflow after fixing the failure.');
  }
  if (result.deleted.length > 0) {
    lines.push('', 'Removed upstream, not deleted locally:');
    for (const item of result.deleted) lines.push(`  ${item}`);
  }
  return lines.join('\n');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = await updateForgeflow(opts);
  if (opts.json) console.log(JSON.stringify(result, null, 2));
  else console.log(renderMarkdown(result));
  if (result.status === 'partial') process.exit(1);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = {
  filesForInstall,
  installFiles,
  renderMarkdown,
  updateForgeflow,
  versionPath,
};
