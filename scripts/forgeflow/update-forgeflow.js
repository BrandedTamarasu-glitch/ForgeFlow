#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const {
  isManagedSource,
  manifestEntry,
  RUNTIME_HELPERS,
  STATIC_FILES,
} = require('./install-manifest');

const DEFAULT_REPO = 'BrandedTamarasu-glitch/ForgeFlow';

function usage() {
  console.error('Usage: update-forgeflow.js [--home <dir>] [--repo owner/name] [--json] [--dry-run] [--repair] [--rollback]');
}

function parseArgs(argv) {
  const opts = {
    home: path.join(os.homedir(), '.claude'),
    repo: DEFAULT_REPO,
    json: false,
    dryRun: false,
    repair: false,
    rollback: false,
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
    } else if (arg === '--repair') {
      opts.repair = true;
    } else if (arg === '--rollback') {
      opts.rollback = true;
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

function backupRoot(home) {
  return path.join(home, 'forgeflow', 'backups', 'previous');
}

function backupManifestPath(home) {
  return path.join(backupRoot(home), 'manifest.json');
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

function shouldSyncSource(source) {
  const entry = manifestEntry(source);
  return Boolean(isManagedSource(source) && entry && !entry.preserve);
}

function requiredManagedSources() {
  return [
    ...Array.from(STATIC_FILES),
    ...RUNTIME_HELPERS,
  ].sort();
}

function missingRequiredManagedFiles(home) {
  return requiredManagedSources()
    .map((source) => manifestEntry(source, home))
    .filter(Boolean)
    .filter((entry) => !entry.preserve && !fs.existsSync(entry.destination))
    .map((entry) => entry.source);
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
    if (item.status === 'removed') {
      if (shouldSyncSource(source)) deleted.push(source);
    } else if (item.status === 'renamed') {
      if (item.previous_filename && shouldSyncSource(item.previous_filename)) {
        deleted.push(item.previous_filename);
      }
      if (shouldSyncSource(source)) files.push(source);
    } else if (['added', 'modified'].includes(item.status) && shouldSyncSource(source)) {
      files.push(source);
    }
  }
  return {
    files: [...new Set(files)].sort(),
    deleted: [...new Set(deleted)].sort(),
    firstRun: false,
  };
}

async function filesForRepair(repo, latest) {
  const data = await request(`https://api.github.com/repos/${repo}/git/trees/${latest}?recursive=1`, 'json');
  return {
    files: managedFilesFromTree(data.tree || []),
    deleted: [],
    firstRun: false,
    repair: true,
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

function snapshotPathForSource(root, source) {
  return path.join(root, 'files', source);
}

function createBackup({ home, files, current, dryRun = false }) {
  if (dryRun || files.length === 0) {
    return {
      path: backupRoot(home),
      files: [],
      version: current || '',
      created: false,
    };
  }

  const root = backupRoot(home);
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(path.join(root, 'files'), { recursive: true });

  const manifest = {
    schema_version: '1',
    created_at: new Date().toISOString(),
    version: current || '',
    files: [],
  };

  const uniqueFiles = [...new Set(files)].sort();
  for (const source of uniqueFiles) {
    const entry = manifestEntry(source, home);
    if (!entry || entry.preserve) continue;

    const item = {
      source,
      destination: entry.destination,
      existed: fs.existsSync(entry.destination),
      mode: null,
      backup: null,
    };

    if (item.existed) {
      const stat = fs.statSync(entry.destination);
      item.mode = stat.mode & 0o777;
      item.backup = snapshotPathForSource(root, source);
      fs.mkdirSync(path.dirname(item.backup), { recursive: true });
      fs.copyFileSync(entry.destination, item.backup);
    }

    manifest.files.push(item);
  }

  fs.writeFileSync(backupManifestPath(home), `${JSON.stringify(manifest, null, 2)}\n`);
  return {
    path: root,
    files: manifest.files,
    version: manifest.version,
    created: true,
  };
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

function deleteFiles({ home, files, dryRun = false }) {
  const removed = [];
  const failed = [];
  for (const source of files) {
    const entry = manifestEntry(source, home);
    if (!entry || entry.preserve) continue;
    try {
      if (fs.existsSync(entry.destination)) {
        if (!dryRun) fs.unlinkSync(entry.destination);
        removed.push({
          source,
          destination: entry.destination,
        });
      }
    } catch (err) {
      failed.push({ source, error: err.message });
    }
  }
  return { removed, failed };
}

function rollbackForgeflow(opts = {}) {
  const home = opts.home || path.join(os.homedir(), '.claude');
  const manifestPath = backupManifestPath(home);
  if (!fs.existsSync(manifestPath)) {
    return {
      schema_version: '1',
      status: 'no-backup',
      restored: [],
      removed: [],
      failed: [],
      version_written: false,
      backup: backupRoot(home),
    };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const restored = [];
  const removed = [];
  const failed = [];

  for (const item of manifest.files || []) {
    try {
      if (item.existed) {
        fs.mkdirSync(path.dirname(item.destination), { recursive: true });
        fs.copyFileSync(item.backup, item.destination);
        if (item.mode !== null && item.mode !== undefined) fs.chmodSync(item.destination, item.mode);
        restored.push({ source: item.source, destination: item.destination });
      } else if (fs.existsSync(item.destination)) {
        fs.unlinkSync(item.destination);
        removed.push({ source: item.source, destination: item.destination });
      }
    } catch (err) {
      failed.push({ source: item.source, error: err.message });
    }
  }

  let versionWritten = false;
  if (failed.length === 0 && manifest.version) {
    fs.writeFileSync(versionPath(home), `${manifest.version}\n`);
    versionWritten = true;
  }

  return {
    schema_version: '1',
    status: failed.length === 0 ? 'rolled-back' : 'rollback-partial',
    restored,
    removed,
    failed,
    version: manifest.version || '',
    version_written: versionWritten,
    backup: backupRoot(home),
  };
}

async function updateForgeflow(opts = {}) {
  const home = opts.home || path.join(os.homedir(), '.claude');
  const repo = opts.repo || DEFAULT_REPO;
  if (opts.rollback) return rollbackForgeflow({ home });

  const current = opts.current !== undefined ? opts.current : readCurrentVersion(home);
  const latest = opts.latest || await latestSha(repo);
  const missingRequired = opts.missingRequired !== undefined
    ? opts.missingRequired
    : missingRequiredManagedFiles(home);
  const repairNeeded = current === latest && !opts.repair && missingRequired.length > 0;
  const effectiveRepair = Boolean(opts.repair || repairNeeded);
  if (current === latest && !effectiveRepair) {
    return {
      schema_version: '1',
      status: 'up-to-date',
      current,
      latest,
      repair_needed: false,
      missing_required: [],
      files: [],
      synced: [],
      failed: [],
      deleted: [],
      version_written: false,
    };
  }

  const plan = opts.plan || (effectiveRepair
    ? await filesForRepair(repo, latest)
    : await filesForInstall(repo, current, latest));
  const backup = createBackup({
    home,
    files: [...plan.files, ...plan.deleted],
    current,
    dryRun: opts.dryRun,
  });
  const installed = await installFiles({
    repo,
    sha: latest,
    home,
    files: plan.files,
    fetcher: opts.fetcher || fetchRaw,
    dryRun: opts.dryRun,
  });
  const removed = installed.failed.length === 0
    ? deleteFiles({ home, files: plan.deleted, dryRun: opts.dryRun })
    : { removed: [], failed: [] };
  const failures = [...installed.failed, ...removed.failed];
  const versionWritten = failures.length === 0 && !opts.dryRun;
  if (versionWritten) {
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(versionPath(home), `${latest}\n`);
  }

  return {
    schema_version: '1',
    status: failures.length === 0 ? (effectiveRepair ? 'repaired' : 'updated') : 'partial',
    current,
    latest,
    first_run: plan.firstRun,
    repair: effectiveRepair,
    repair_needed: repairNeeded,
    missing_required: missingRequired,
    files: plan.files,
    synced: installed.synced,
    failed: failures,
    deleted: plan.deleted,
    removed: removed.removed,
    version_written: versionWritten,
    backup,
  };
}

function renderMarkdown(result) {
  if (result.status === 'no-backup') {
    return `No Forgeflow rollback snapshot found at ${result.backup}.`;
  }
  if (result.status === 'rolled-back' || result.status === 'rollback-partial') {
    const lines = [
      result.status === 'rolled-back' ? 'Forgeflow rolled back.' : 'Forgeflow rollback partially completed.',
      '',
      `Files restored (${result.restored.length}):`,
    ];
    for (const item of result.restored) lines.push(`  ${item.source}`);
    if (result.removed.length > 0) {
      lines.push('', `Files removed (${result.removed.length}):`);
      for (const item of result.removed) lines.push(`  ${item.source}`);
    }
    if (result.failed.length > 0) {
      lines.push('', 'Rollback failures:');
      for (const item of result.failed) lines.push(`  ${item.source}: ${item.error}`);
    }
    if (result.version_written) lines.push('', `Version restored to ${result.version.slice(0, 7)}.`);
    return lines.join('\n');
  }

  const latestShort = result.latest.slice(0, 7);
  const currentShort = result.current ? result.current.slice(0, 7) : 'none';
  if (result.status === 'up-to-date') return `Already up to date (${latestShort}).`;
  const lines = [
    result.repair
      ? `Forgeflow repaired (${latestShort})`
      : (result.first_run ? `Forgeflow installed (${latestShort})` : `Forgeflow updated (${currentShort} -> ${latestShort})`),
    '',
    `Files synced (${result.synced.length}):`,
  ];
  if (result.repair_needed && result.missing_required?.length > 0) {
    lines.splice(1, 0, `Missing managed files detected (${result.missing_required.length}); running repair sync.`);
  }
  for (const item of result.synced) {
    lines.push(`  ${item.source}  ${item.before} -> ${item.after}`);
  }
  if (result.failed.length > 0) {
    lines.push('', 'Failed downloads:');
    for (const item of result.failed) lines.push(`  ${item.source}: ${item.error}`);
    lines.push('', 'Version was not updated. Re-run /update-forgeflow after fixing the failure.');
  }
  if (result.deleted.length > 0) {
    lines.push('', result.removed && result.removed.length > 0 ? 'Files removed:' : 'Removed upstream, not present locally:');
    for (const item of result.deleted) lines.push(`  ${item}`);
  }
  if (result.backup?.created) {
    lines.push('', `Rollback snapshot: ${result.backup.path}`);
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
  filesForRepair,
  installFiles,
  deleteFiles,
  missingRequiredManagedFiles,
  renderMarkdown,
  requiredManagedSources,
  rollbackForgeflow,
  updateForgeflow,
  versionPath,
};
