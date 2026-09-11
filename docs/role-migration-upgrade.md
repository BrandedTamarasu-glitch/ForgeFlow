# Upgrade installations with legacy role names

The first upgrade from Smith, Warden, Lumen, Atlas, Arbiter, Compass and Aegis
requires the installer from a complete new source checkout. An older installed
updater can remove customized legacy files from the active installation, even
when it downloads a new updater in the same operation. Do not start this
migration with the old installed `/update-forgeflow` or `$update-forgeflow`.

Release prerequisite: include this procedure in the rename release announcement
and link existing users to it before their first update. The rename release must
not advertise an unattended upgrade through the old executable. Publishing new
helper code alone cannot make those installed executables safe.

## Run the source installer

Get the full commit SHA for the rename release from its release announcement.
In Bash, set `FORGEFLOW_RELEASE_SHA` to that SHA, then run:

```bash
: "${FORGEFLOW_RELEASE_SHA:?Set this to the reviewed rename release commit SHA}"
[[ "$FORGEFLOW_RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]] || exit 1
FORGEFLOW_MIGRATION_DIR=$(mktemp -d)
git clone https://github.com/BrandedTamarasu-glitch/ForgeFlow.git "$FORGEFLOW_MIGRATION_DIR/source" || exit 1
git -C "$FORGEFLOW_MIGRATION_DIR/source" checkout --detach "$FORGEFLOW_RELEASE_SHA" || exit 1
cd "$FORGEFLOW_MIGRATION_DIR/source" || exit 1
```

Choose the host you use. Preview the destination plan, then install from that
same checkout. These are the existing template installer entrypoints; they do
not launch the installed updater:

```bash
# Claude Code
node scripts/forgeflow/install-template.js --target claude --dry-run --json
node scripts/forgeflow/install-template.js --target claude

# Codex, honoring CODEX_HOME when set
node scripts/forgeflow/install-template.js --target codex --dry-run --json
node scripts/forgeflow/install-template.js --target codex
```

Run only the pair for your host, or both pairs if you use both. For a nonstandard
Claude home, add `--claude-home /absolute/path` to both Claude commands; use
`--codex-home /absolute/path` for a nonstandard Codex home.

The installer copies the managed source tree, so customized current managed
files can be replaced. Inspect the preview and keep an independent copy of any
customizations you want to merge. Legacy files are removed only when their bytes
match the recorded stock version and the replacement is part of this install.
Edited or unverified legacy files remain in place and appear in
`preserved_legacy`; merge their instructions into the new role deliberately.
Unknown custom files remain untouched. Historical project state is not rewritten.

Restart the host to discover the new names. Keep the checkout until validation
and any rollback are complete. The installer retains the existing version marker;
future updates run the newly installed helper. Do not run a repair merely to
refresh that marker, because a changed install replaces the previous snapshot.

## Recovery

A byte-identical reinstall preserves the migration snapshot. A later installation
that changes files, or an explicit repair, replaces that single recovery point.
Before another update, recover from the migration with the helper in the source
checkout used above:

```bash
node scripts/forgeflow/update-forgeflow.js --target claude --home "$HOME/.claude" --rollback
node scripts/forgeflow/update-forgeflow.js --target codex --home "${CODEX_HOME:-$HOME/.codex}" --rollback
```

Use only the command for the affected host and the same custom home, if any.
Rollback restores the managed bytes and modes in the previous snapshot and
removes files newly created by that operation. Restart the host again afterward.

If the old updater already performed the migration, its backup may still contain
removed customizations. Run its `--rollback` immediately, before another install
or repair, then follow the source-checkout procedure. Once another operation has
replaced that snapshot, use your independent backup; historical snapshots are
not retained.

The local regression `node scripts/forgeflow/test-update-migration.js` runs the
actual pre-migration HEAD updater and dependencies from commit
`a0a8a85edf21ee406713eff8718f181f4d7401e3`, demonstrates that unsafe route, then
checks source installation, edited-file preservation, repeated-install recovery,
and stock-only cleanup for both hosts. It needs that commit in local Git history
and performs no network downloads or live-home installation.
