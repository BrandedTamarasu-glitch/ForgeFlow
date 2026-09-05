#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const {
  CODEX_INVENTORY_SOURCE,
  codexInventoryContent,
  readCodexInventory,
  manifestEntry,
  assertSafeDestination,
  managedSources,
  normalizeTarget,
  RUNTIME_HELPERS,
  STATIC_FILES,
} = require('./install-manifest');
let affectedCommandsForSources = () => [];
function isMissingRuntimeHelperContractError(err) {
  return err
    && err.code === 'MODULE_NOT_FOUND'
    && String(err.message || '').includes("'./runtime-helper-contract'");
}
try {
  ({ affectedCommandsForSources } = require('./runtime-helper-contract'));
} catch (err) {
  if (!isMissingRuntimeHelperContractError(err)) {
    throw err;
  }
  // Keep the updater usable during repair of installs that are missing newer helper dependencies.
}

const DEFAULT_REPO = 'BrandedTamarasu-glitch/ForgeFlow';

function usage() {
  console.error('Usage: update-forgeflow.js [--target claude|codex] [--home <dir>] [--repo owner/name] [--json] [--dry-run] [--repair] [--rollback]');
}

function parseArgs(argv) {
  const opts = {
    target: 'claude',
    home: '',
    repo: DEFAULT_REPO,
    json: false,
    dryRun: false,
    repair: false,
    rollback: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--target') {
      opts.target = argv[++i] || '';
    } else if (arg === '--home') {
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
  try {
    opts.target = normalizeTarget(opts.target);
  } catch (err) {
    console.error(err.message);
    usage();
    process.exit(2);
  }
  if (!opts.home) opts.home = opts.target === 'codex'
    ? (process.env.CODEX_HOME || path.join(os.homedir(), '.codex'))
    : path.join(os.homedir(), '.claude');
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

function managedFilesFromTree(tree, target = 'claude') {
  return tree
    .filter((entry) => entry.type === 'blob')
    .map((entry) => entry.path)
    .filter((source) => Boolean(manifestEntry(source, '', target)))
    .filter((source) => !manifestEntry(source, '', target).preserve)
    .sort();
}

function shouldSyncSource(source, target = 'claude') {
  const entry = manifestEntry(source, '', target);
  return Boolean(entry && !entry.preserve);
}

function requiredManagedSources(target = 'claude', home) {
  if (normalizeTarget(target) === 'codex') {
    if (home) return readCodexInventory(home) || [...RUNTIME_HELPERS, CODEX_INVENTORY_SOURCE];
    const root = path.resolve(__dirname, '..', '..');
    if (fs.existsSync(path.join(root, '.codex', 'agents'))) return managedSources(root, 'codex');
    return readCodexInventory(path.dirname(root)) || [...RUNTIME_HELPERS, CODEX_INVENTORY_SOURCE];
  }
  return [
    ...Array.from(STATIC_FILES),
    ...RUNTIME_HELPERS,
  ].sort();
}

function missingRequiredManagedFiles(home, target = 'claude') {
  return requiredManagedSources(target, home)
    .map((source) => manifestEntry(source, home, target))
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

async function filesForInstall(repo, current, latest, target = 'claude') {
  if (!current) {
    const data = await request(`https://api.github.com/repos/${repo}/git/trees/${latest}?recursive=1`, 'json');
    return {
      files: managedFilesFromTree(data.tree || [], target),
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
      if (shouldSyncSource(source, target)) deleted.push(source);
    } else if (item.status === 'renamed') {
      if (item.previous_filename && shouldSyncSource(item.previous_filename, target)) {
        deleted.push(item.previous_filename);
      }
      if (shouldSyncSource(source, target)) files.push(source);
    } else if (['added', 'modified'].includes(item.status) && shouldSyncSource(source, target)) {
      files.push(source);
    }
  }
  return {
    files: [...new Set(files)].sort(),
    deleted: [...new Set(deleted)].sort(),
    firstRun: false,
  };
}

async function filesForRepair(repo, latest, target = 'claude') {
  const data = await request(`https://api.github.com/repos/${repo}/git/trees/${latest}?recursive=1`, 'json');
  return {
    files: managedFilesFromTree(data.tree || [], target),
    deleted: [],
    firstRun: false,
    repair: true,
  };
}

async function fetchRaw(repo, sha, source) {
  return request(`https://raw.githubusercontent.com/${repo}/${sha}/${source}`, 'text');
}

function writeAtomic(file, content, executable, home) {
  assertSafeDestination(file, home);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  assertSafeDestination(file, home);
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${crypto.randomUUID()}.tmp`);
  try {
    fs.writeFileSync(tmp, content, { flag: 'wx', mode: executable ? 0o755 : 0o644 });
    fs.chmodSync(tmp, executable ? 0o755 : 0o644);
    assertSafeDestination(file, home);
    fs.renameSync(tmp, file);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}

function snapshotPathForSource(root, source) {
  return path.join(root, 'files', source);
}

function createBackup({ home, target = 'claude', files, current, latest, dryRun = false }) {
  const root = backupRoot(home);
  if (dryRun) return { path: root, files: [], version: current || '', created: false };
  assertSafeDestination(backupManifestPath(home), home);
  const previous = fs.existsSync(backupManifestPath(home))
    ? JSON.parse(fs.readFileSync(backupManifestPath(home), 'utf8')) : null;
  // A retry of the same target SHA must retain every original byte.
  // A completed same-SHA repair is a new operation, so version equality alone
  // must never decide whether to reuse the snapshot.
  const reuse = previous?.pending === true;
  if (reuse && (previous.version !== (current || '') || previous.target !== target)) {
    throw new Error('Pending update belongs to a different version or runtime; roll it back before updating.');
  }
  assertSafeDestination(versionPath(home), home);
  const versionStat = fs.lstatSync(versionPath(home), { throwIfNoEntry: false });
  const inventory = [...new Set(files)].sort();
  fs.mkdirSync(path.dirname(root), { recursive: true });
  const stage = reuse ? root : fs.mkdtempSync(path.join(path.dirname(root), '.snapshot-'));
  const manifest = reuse ? previous : {
    schema_version: '2', target, pending: true, to_version: latest,
    created_at: new Date().toISOString(), version: current || '',
    version_file: versionStat ? {
      content: fs.readFileSync(versionPath(home)).toString('base64'), mode: versionStat.mode & 0o777,
    } : null,
    files: [],
  };
  try {
    for (const source of inventory) {
      if (manifest.files.some((item) => item.source === source)) continue;
      const entry = manifestEntry(source, home, target);
      if (!entry || entry.preserve) continue;
      assertSafeDestination(entry.destination, home);
      const stat = fs.lstatSync(entry.destination, { throwIfNoEntry: false });
      const item = { source, destination: entry.destination, existed: Boolean(stat), mode: null, backup: null };
      if (stat) {
        if (!stat.isFile()) throw new Error(`Refusing non-regular runtime file: ${entry.destination}`);
        item.mode = stat.mode & 0o777;
        item.backup = snapshotPathForSource(root, source);
        const copy = snapshotPathForSource(stage, source);
        assertSafeDestination(copy, home);
        fs.mkdirSync(path.dirname(copy), { recursive: true });
        fs.copyFileSync(entry.destination, copy);
      }
      manifest.files.push(item);
    }
    writeAtomic(path.join(stage, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, false, home);
    if (!reuse) {
      const displaced = `${stage}-previous`;
      const hadPrevious = fs.existsSync(root);
      if (hadPrevious) fs.renameSync(root, displaced);
      try {
        fs.renameSync(stage, root);
      } catch (err) {
        if (hadPrevious) fs.renameSync(displaced, root);
        throw err;
      }
      if (hadPrevious) fs.rmSync(displaced, { recursive: true, force: true });
    }
  } catch (err) {
    if (!reuse) fs.rmSync(stage, { recursive: true, force: true });
    throw err;
  }
  return { path: root, files: manifest.files, version: manifest.version, created: !reuse, reused: reuse };
}

async function installFiles({ repo, sha, home, target = 'claude', files, fetcher = fetchRaw, dryRun = false }) {
  const synced = [];
  const failed = [];
  for (const source of files) {
    const entry = manifestEntry(source, home, target);
    if (!entry || entry.preserve) continue;
    const before = sha256File(entry.destination);
    try {
      const content = dryRun ? '' : await fetcher(repo, sha, source);
      if (!dryRun) writeAtomic(entry.destination, content, entry.executable, home);
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

function deleteFiles({ home, target = 'claude', files, dryRun = false }) {
  const removed = [];
  const failed = [];
  for (const source of files) {
    const entry = manifestEntry(source, home, target);
    if (!entry || entry.preserve) continue;
    try {
      if (fs.existsSync(entry.destination)) {
        if (!dryRun) {
          assertSafeDestination(entry.destination, home);
          fs.unlinkSync(entry.destination);
        }
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
  const target = normalizeTarget(opts.target || 'claude');
  const home = opts.home || (target === 'codex' ? (process.env.CODEX_HOME || path.join(os.homedir(), '.codex')) : path.join(os.homedir(), '.claude'));
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

  assertSafeDestination(manifestPath, home);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.target && manifest.target !== target) throw new Error('Rollback snapshot belongs to a different runtime.');
  const dryRun = Boolean(opts.dryRun);
  const restored = [];
  const removed = [];
  const failed = [];

  for (const item of manifest.files || []) {
    try {
      const entry = manifestEntry(item.source, home, target);
      if (!entry || entry.preserve || entry.destination !== item.destination) throw new Error('Invalid rollback destination');
      assertSafeDestination(item.destination, home);
      if (item.existed) {
        if (item.backup !== snapshotPathForSource(backupRoot(home), item.source)) throw new Error('Invalid rollback source');
        assertSafeDestination(item.backup, home);
        if (!fs.statSync(item.backup).isFile()) throw new Error('Invalid rollback snapshot file');
        if (!dryRun) {
          writeAtomic(item.destination, fs.readFileSync(item.backup), Boolean(item.mode & 0o111), home);
          if (item.mode !== null && item.mode !== undefined) fs.chmodSync(item.destination, item.mode);
        }
        restored.push({ source: item.source, destination: item.destination });
      } else if (fs.existsSync(item.destination)) {
        assertSafeDestination(item.destination, home);
        if (!dryRun) fs.unlinkSync(item.destination);
        removed.push({ source: item.source, destination: item.destination });
      }
    } catch (err) {
      failed.push({ source: item.source, error: err.message });
    }
  }

  let versionWritten = false;
  if (failed.length === 0 && !dryRun) {
    try {
      assertSafeDestination(versionPath(home), home);
      if (manifest.version_file) {
        writeAtomic(versionPath(home), Buffer.from(manifest.version_file.content, 'base64'), false, home);
        fs.chmodSync(versionPath(home), manifest.version_file.mode);
        versionWritten = true;
      } else if (manifest.schema_version === '2') {
        if (fs.existsSync(versionPath(home))) fs.unlinkSync(versionPath(home));
      } else if (manifest.version) {
        writeAtomic(versionPath(home), `${manifest.version}\n`, false, home);
        versionWritten = true;
      }
      manifest.pending = false;
      writeAtomic(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, false, home);
    } catch (err) {
      failed.push({ source: 'forgeflow-version', error: err.message });
    }
  }

  return {
    schema_version: '1',
    status: failed.length === 0 ? (dryRun ? 'rollback-preview' : 'rolled-back') : 'rollback-partial',
    dry_run: dryRun,
    restored,
    removed,
    failed,
    version: manifest.version || '',
    version_written: versionWritten,
    backup: backupRoot(home),
  };
}

async function updateForgeflow(opts = {}) {
  const target = normalizeTarget(opts.target || 'claude');
  const home = opts.home || (target === 'codex' ? (process.env.CODEX_HOME || path.join(os.homedir(), '.codex')) : path.join(os.homedir(), '.claude'));
  const repo = opts.repo || DEFAULT_REPO;
  if (opts.rollback) return rollbackForgeflow({ home, target, dryRun: opts.dryRun });

  assertSafeDestination(backupManifestPath(home), home);
  const pending = fs.existsSync(backupManifestPath(home))
    ? JSON.parse(fs.readFileSync(backupManifestPath(home), 'utf8')) : null;
  // The version marker may already have been written when completion was
  // interrupted. The pending snapshot remains the authority until committed.
  const current = pending?.pending ? pending.version
    : (opts.current !== undefined ? opts.current : readCurrentVersion(home));
  const latest = opts.latest || await latestSha(repo);
  if (pending?.pending && pending.to_version !== latest) {
    const expected = pending.to_version || 'an unknown target SHA';
    throw new Error(`Pending update targets ${expected}; cannot resume at ${latest}. Run --rollback with the same --target and --home, then rerun the update to install the latest version.`);
  }
  const missingRequired = opts.missingRequired !== undefined
    ? opts.missingRequired
    : missingRequiredManagedFiles(home, target);
  const inventory = target === 'codex' ? readCodexInventory(home) : null;
  const inventoryMissing = target === 'codex' && !inventory;
  const repairNeeded = !opts.repair && ((current === latest && missingRequired.length > 0) || (Boolean(current) && inventoryMissing));
  const effectiveRepair = Boolean(opts.repair || repairNeeded || (pending?.pending && current === latest));
  if (current === latest && !effectiveRepair) {
    return {
      schema_version: '1',
      status: 'up-to-date',
      current,
      latest,
      repair_needed: false,
    missing_required: [],
    affected_commands: [],
    files: [],
      synced: [],
      failed: [],
      deleted: [],
      version_written: false,
    };
  }

  const plan = opts.plan || (effectiveRepair
    ? await filesForRepair(repo, latest, target)
    : await filesForInstall(repo, current, latest, target));
  const backup = createBackup({
    home,
    target,
    files: [...plan.files, ...plan.deleted, ...(target === 'codex' ? [CODEX_INVENTORY_SOURCE] : [])],
    current,
    latest,
    dryRun: opts.dryRun,
  });
  const installed = await installFiles({
    repo,
    sha: latest,
    home,
    target,
    files: plan.files,
    fetcher: opts.fetcher || fetchRaw,
    dryRun: opts.dryRun,
  });
  const removed = installed.failed.length === 0
    ? deleteFiles({ home, target, files: plan.deleted, dryRun: opts.dryRun })
    : { removed: [], failed: [] };
  const failures = [...installed.failed, ...removed.failed];
  let versionWritten = false;
  if (failures.length === 0 && !opts.dryRun) {
    try {
      if (target === 'codex') {
        const sources = [...(effectiveRepair ? [] : inventory || []), ...plan.files]
          .filter((source) => !plan.deleted.includes(source) && manifestEntry(source, home, target));
        writeAtomic(manifestEntry(CODEX_INVENTORY_SOURCE, home, target).destination, codexInventoryContent(sources), false, home);
      }
      writeAtomic(versionPath(home), `${latest}\n`, false, home);
      const manifest = JSON.parse(fs.readFileSync(backupManifestPath(home), 'utf8'));
      manifest.pending = false;
      writeAtomic(backupManifestPath(home), `${JSON.stringify(manifest, null, 2)}\n`, false, home);
      versionWritten = true;
    } catch (err) {
      failures.push({ source: 'forgeflow-version', error: err.message });
    }
  }
  const affectedSources = repairNeeded && missingRequired.length > 0
    ? missingRequired
    : [...plan.files, ...plan.deleted];

  return {
    schema_version: '1',
    target,
    status: failures.length === 0 ? (effectiveRepair ? 'repaired' : 'updated') : 'partial',
    current,
    latest,
    first_run: plan.firstRun,
    repair: effectiveRepair,
    repair_needed: repairNeeded,
    missing_required: missingRequired,
    inventory_missing: inventoryMissing,
    affected_commands: affectedCommandsForSources(affectedSources, { root: path.resolve(__dirname, '..', '..') }),
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
  if (['rolled-back', 'rollback-partial', 'rollback-preview'].includes(result.status)) {
    const lines = [
      result.status === 'rollback-preview' ? 'Forgeflow rollback preview (no files changed).'
        : (result.status === 'rolled-back' ? 'Forgeflow rolled back.' : 'Forgeflow rollback partially completed.'),
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
  if (result.affected_commands && result.affected_commands.length > 0) {
    lines.push('', 'Affected commands:');
    for (const item of result.affected_commands) {
      lines.push(`  ${item.command}: ${item.helpers.map((helper) => path.basename(helper)).join(', ')}`);
    }
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
  if (result.status === 'partial' || result.status === 'rollback-partial') process.exit(1);
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
  isMissingRuntimeHelperContractError,
  deleteFiles,
  missingRequiredManagedFiles,
  renderMarkdown,
  requiredManagedSources,
  rollbackForgeflow,
  updateForgeflow,
  versionPath,
};
