#!/usr/bin/env node
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { manifestEntry, RUNTIME_HELPERS } = require('./install-manifest');
const { writeJsonSafe } = require('./file-safety');
const { groupRuntimeHelpers, helperGroupForSource } = require('./runtime-inventory');

const DEFAULT_REPO = 'BrandedTamarasu-glitch/ForgeFlow';

function usage() {
  console.error('Usage: forgeflow-version.js [--home <dir>] [--repo owner/name] [--json] [--offline] [--snapshot]');
}

function parseArgs(argv) {
  const opts = {
    home: path.join(os.homedir(), '.claude'),
    repo: DEFAULT_REPO,
    json: false,
    offline: false,
    snapshot: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--home') {
      opts.home = path.resolve(argv[++i] || '');
    } else if (arg === '--repo') {
      opts.repo = argv[++i] || DEFAULT_REPO;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--offline') {
      opts.offline = true;
    } else if (arg === '--snapshot') {
      opts.snapshot = true;
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

function request(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Forgeflow version',
        Accept: 'application/vnd.github+json',
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
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

function versionFile(home) {
  return path.join(home, 'forgeflow-version');
}

function versionSnapshotPath(home) {
  return path.join(home, 'forgeflow', 'version-snapshot.json');
}

function readInstalledVersion(home) {
  const file = versionFile(home);
  if (!fs.existsSync(file)) {
    return { status: 'missing', sha: '', path: file };
  }

  const sha = fs.readFileSync(file, 'utf8').trim();
  if (!/^[0-9a-f]{40}$/i.test(sha)) {
    return { status: 'corrupt', sha, path: file };
  }

  return { status: 'present', sha, path: file };
}

function existsWithPath(file) {
  return {
    path: file,
    exists: fs.existsSync(file),
  };
}

function missingRequiredPaths(paths) {
  return Object.entries(paths)
    .filter(([_name, item]) => !item.exists)
    .map(([name, item]) => ({ name, path: item.path }));
}

function runtimeHelperInventory(home) {
  const expected = RUNTIME_HELPERS.map((source) => {
    const entry = manifestEntry(source, home);
    let exists = false;
    let regular_file = false;
    let issue = 'missing';
    if (entry && fs.existsSync(entry.destination)) {
      exists = true;
      const stat = fs.lstatSync(entry.destination);
      regular_file = stat.isFile();
      issue = regular_file ? '' : 'not-regular-file';
    }
    return {
      source,
      helper_group: helperGroupForSource(source),
      path: entry ? entry.destination : '',
      exists,
      regular_file,
      issue,
    };
  });
  const missing = expected.filter((item) => !item.regular_file).map(({ source, path: helperPath, issue }) => ({
    source,
    helper_group: helperGroupForSource(source),
    path: helperPath,
    issue,
  }));
  return {
    status: missing.length > 0 ? 'repair-needed' : 'complete',
    expected: expected.length,
    present: expected.length - missing.length,
    missing,
    missing_groups: groupRuntimeHelpers(missing),
    repair_command: missing.length > 0 ? '/update-forgeflow --repair' : '',
  };
}

function repairAction(result) {
  const updateCommand = result.paths?.update_command?.exists;
  const updater = result.paths?.updater?.exists;
  if (updateCommand) return 'Run /update-forgeflow --repair.';
  if (updater) return `Run ${result.paths.updater.path} --repair.`;
  return 'Run scripts/forgeflow/update-forgeflow.js --repair from a local Forgeflow checkout.';
}

async function latestMain(repo) {
  const data = await request(`https://api.github.com/repos/${repo}/commits/main`);
  const sha = data.sha || '';
  if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error('Unexpected latest SHA from GitHub');
  return {
    sha,
    html_url: data.html_url || '',
    date: data.commit?.committer?.date || data.commit?.author?.date || '',
  };
}

async function latestRelease(repo) {
  const data = await request(`https://api.github.com/repos/${repo}/releases/latest`);
  return {
    tag_name: data.tag_name || '',
    name: data.name || '',
    html_url: data.html_url || '',
    published_at: data.published_at || '',
    target_commitish: data.target_commitish || '',
  };
}

async function getVersionStatus(opts = {}) {
  const home = opts.home || path.join(os.homedir(), '.claude');
  const repo = opts.repo || DEFAULT_REPO;
  const installed = readInstalledVersion(home);
  const installedHelper = existsWithPath(path.join(home, 'forgeflow', 'scripts', 'forgeflow'));
  const installedUpdater = existsWithPath(path.join(home, 'forgeflow', 'scripts', 'forgeflow', 'update-forgeflow.js'));
  const installedCommand = existsWithPath(path.join(home, 'commands', 'update-forgeflow.md'));
  const installedVersionCommand = existsWithPath(path.join(home, 'commands', 'forgeflow-version.md'));
  const statusline = existsWithPath(path.join(home, 'hooks', 'forgeflow-statusline.js'));

  const result = {
    schema_version: '1',
    repo,
    home,
    installed,
    upstream: {
      status: opts.offline ? 'skipped-offline' : 'unknown',
      main: null,
      latest_release: null,
      error: '',
    },
    paths: {
      helper_root: installedHelper,
      updater: installedUpdater,
      update_command: installedCommand,
      version_command: installedVersionCommand,
      statusline_hook: statusline,
    },
    status: 'unknown',
    action: '',
    help: '',
  };
  result.path_status = {
    missing_required: missingRequiredPaths(result.paths),
  };
  result.runtime_helpers = runtimeHelperInventory(home);
  result.snapshot = {
    path: versionSnapshotPath(home),
    saved: false,
  };

  if (!opts.offline) {
    try {
      const [main, release] = await Promise.all([
        latestMain(repo),
        latestRelease(repo).catch((err) => ({ error: err.message })),
      ]);
      result.upstream.status = 'ok';
      result.upstream.main = main;
      result.upstream.latest_release = release.error ? null : release;
      if (release.error) result.upstream.release_error = release.error;
    } catch (err) {
      result.upstream.status = 'error';
      result.upstream.error = err.message;
    }
  }

  if (installed.status === 'missing') {
    result.status = 'not-installed';
    result.action = 'Run /update-forgeflow.';
    result.help = 'If the slash command is unavailable, run scripts/forgeflow/update-forgeflow.js from a local checkout.';
  } else if (installed.status === 'corrupt') {
    result.status = 'corrupt-version';
    result.action = `Delete ${installed.path}, then run /update-forgeflow.`;
  } else if (result.upstream.status === 'ok' && result.upstream.main?.sha) {
    if (installed.sha === result.upstream.main.sha) {
      if (result.path_status.missing_required.length > 0 || result.runtime_helpers.missing.length > 0) {
        result.status = 'repair-needed';
        result.action = repairAction(result);
        result.help = 'The recorded version matches upstream, but required installed files are missing.';
      } else {
        result.status = 'up-to-date';
        result.action = 'No update needed.';
      }
    } else {
      result.status = 'outdated';
      result.action = '/update-forgeflow';
    }
  } else if (result.upstream.status === 'skipped-offline') {
    if (result.path_status.missing_required.length > 0 || result.runtime_helpers.missing.length > 0) {
      result.status = 'repair-needed';
      result.action = repairAction(result);
      result.help = 'Offline mode skipped upstream comparison, but required installed files are missing.';
    } else {
      result.status = 'installed-offline';
      result.action = 'Run without --offline to compare against upstream main.';
    }
  } else {
    result.status = 'installed-unknown-upstream';
    result.action = 'Re-run /forgeflow-version when GitHub is reachable.';
    result.help = 'If you need to repair now, run /update-forgeflow.';
  }

  return result;
}

function saveVersionSnapshot(result) {
  result.snapshot = {
    path: versionSnapshotPath(result.home),
    saved: true,
  };
  writeJsonSafe(result.snapshot.path, result);
  return result;
}

function shortSha(sha) {
  return sha ? sha.slice(0, 7) : 'none';
}

function yesNo(value) {
  return value ? 'yes' : 'no';
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Version',
    '',
    `Status: ${result.status}`,
    `Installed: ${result.installed.status === 'present' ? shortSha(result.installed.sha) : result.installed.status}`,
  ];

  if (result.upstream.main?.sha) {
    lines.push(`Upstream main: ${shortSha(result.upstream.main.sha)}`);
  } else {
    lines.push(`Upstream main: ${result.upstream.status}`);
  }

  if (result.upstream.latest_release) {
    const release = result.upstream.latest_release;
    lines.push(`Latest release: ${release.tag_name || 'unknown'}${release.published_at ? ` (${release.published_at})` : ''}`);
  } else if (result.upstream.release_error) {
    lines.push(`Latest release: unavailable (${result.upstream.release_error})`);
  }

  lines.push('', '## Paths', '');
  lines.push(`- Home: ${result.home}`);
  if (result.snapshot) {
    lines.push(`- Snapshot: ${result.snapshot.saved ? `saved to ${result.snapshot.path}` : result.snapshot.path}`);
  }
  lines.push(`- Version file: ${result.installed.path}`);
  lines.push(`- Runtime helpers: ${result.paths.helper_root.path} (${yesNo(result.paths.helper_root.exists)})`);
  lines.push(`- Updater helper: ${result.paths.updater.path} (${yesNo(result.paths.updater.exists)})`);
  lines.push(`- /update-forgeflow command: ${result.paths.update_command.path} (${yesNo(result.paths.update_command.exists)})`);
  lines.push(`- /forgeflow-version command: ${result.paths.version_command.path} (${yesNo(result.paths.version_command.exists)})`);
  lines.push(`- Statusline hook: ${result.paths.statusline_hook.path} (${yesNo(result.paths.statusline_hook.exists)})`);
  lines.push(`- Runtime helper inventory: ${result.runtime_helpers.present}/${result.runtime_helpers.expected}`);
  if (result.path_status?.missing_required?.length > 0) {
    lines.push('', '## Missing Required Paths', '');
    for (const item of result.path_status.missing_required) {
      lines.push(`- ${item.name}: ${item.path}`);
    }
  }
  if (result.runtime_helpers?.missing?.length > 0) {
    lines.push('', '## Missing Runtime Helpers', '');
    for (const group of result.runtime_helpers.missing_groups || []) {
      lines.push(`- ${group.group}: ${group.count}`);
    }
    lines.push('');
    for (const item of result.runtime_helpers.missing.slice(0, 30)) {
      lines.push(`- ${item.source}: ${item.helper_group}; ${item.path}${item.issue ? ` (${item.issue})` : ''}`);
    }
    if (result.runtime_helpers.missing.length > 30) lines.push(`- ... ${result.runtime_helpers.missing.length - 30} more`);
    lines.push('', `Repair: ${result.action || result.runtime_helpers.repair_command}`);
  }

  lines.push('', '## Next Step', '', result.action);
  if (result.help) lines.push('', result.help);
  return lines.join('\n');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = await getVersionStatus(opts);
  if (opts.snapshot) saveVersionSnapshot(result);
  if (opts.json) console.log(JSON.stringify(result, null, 2));
  else console.log(renderMarkdown(result));
  if (['corrupt-version'].includes(result.status)) process.exit(1);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = {
  getVersionStatus,
  missingRequiredPaths,
  readInstalledVersion,
  renderMarkdown,
  runtimeHelperInventory,
  saveVersionSnapshot,
  repairAction,
  shortSha,
  versionSnapshotPath,
};
