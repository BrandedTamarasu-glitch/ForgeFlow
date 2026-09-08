# Shared project memory with an Obsidian vault

Local memory is the default. Forgeflow does not require Obsidian, an Obsidian account, or a vault. Without explicit connection setup, memory recording and retrieval use the existing local storage and create no vault connection or publication queue.

Vault sharing is an optional addition to local memory. Local learnings are saved before any shared publication is attempted. If a configured vault disappears or its connection settings are invalid, local recording and retrieval continue; unavailable shared notes are withheld and a diagnostic is reported. Obsidian does not need to be running for Forgeflow to use accessible vault files.

Forgeflow can publish curated Markdown notes into a local Obsidian vault and retrieve them from another checkout of the same project. Obsidian Sync handles device transfer. Forgeflow does not manage your Obsidian account, credentials, Sync configuration, or remote delivery.

This is an opt-in connection per checkout. The same project ID identifies the shared notes on both computers; local repository and vault paths can differ. Use a distinct ID for each unrelated project. Connection settings live in the ignored `.forgeflow/vault.json` and should stay local.

## Connect a checkout

Run the helper from the updated Forgeflow checkout, or use its path in an installed Forgeflow runtime:

```sh
node scripts/forgeflow/vault-memory.js connect \
  --root /path/to/project \
  --vault /path/to/local/Obsidian-vault \
  --project-id my-project \
  --publish-learnings
```

On your second computer, connect its checkout and local copy of the synced vault using the same `my-project` ID. The updated helper and memory integration must also be installed there. Source code continues to transfer through your normal Git workflow.

`--publish-learnings` enables mirroring for new entries recorded through `record-project-learning.js`, including lifecycle corrections. It does not export existing history. Omit this option to enable retrieval and explicit note writing only. Reconnecting with the same project ID changes the vault path or this setting. Disconnect before assigning a different project identity.

The explicit memory, home and handoff commands create their respective parts of this structure:

```text
Your vault/
  Forgeflow/
    Projects/
      my-project/
        Home.md
        Handoffs/
          vh_<stable-id>.md
        Memories/
          readable-note-title--vm_<unique-id>.md
```

Existing notes and `.obsidian` configuration are left alone. Generated indexes, raw conversations, telemetry, logs and global user profiles stay local. Command-interface telemetry-derived learnings also stay local because they have a separate outcome lifecycle.

## Write shared guidance

Create a JSON input file outside the synced vault:

```json
{
  "title": "Keep portal identity separate from staff identity",
  "body": "The external portal uses scoped contact access. Staff administration should use the backoffice identity. Recheck the access boundary when changing either flow.",
  "dependencies": ["src/portal/auth.ts"],
  "conflict_key": "portal_identity",
  "conflict_value": "scoped_contact"
}
```

`title` and `body` are required. Optional `dependencies` are actual repository-relative files. Their content hashes are stored in the note, while source contents remain in the checkout. Omit dependencies for general project guidance; such notes remain unverified guidance when moving between revisions.

Preview the exact note before publishing:

```sh
node scripts/forgeflow/vault-memory.js write --root /path/to/project --input /tmp/note.json --dry-run
node scripts/forgeflow/vault-memory.js write --root /path/to/project --input /tmp/note.json
```

A successful write confirms the local file only. Check Obsidian's Sync status and the receiving computer to establish remote delivery. No Obsidian API plugin is required. Filesystem permissions still apply to the chosen vault.

New curated learnings recorded through the normal recorder use the same publisher when mirroring is enabled. Unavailable vaults or rejected content leave the original local learning intact and return a vault status/warning. Authorized publication intents are retained in a local outbox when publication cannot finish. Use the explicit retry command after recovery. Identical current shared entries are deduplicated. If multiple shared revisions exist, resolve them explicitly before retrying.

The existing privacy filter rejects suspected credentials, private addresses, and machine-specific absolute paths. This is a conservative heuristic, not guaranteed secret detection. Only publish content appropriate for every device/person with vault access. Unavailable or stale local provenance is withheld from automatic publishing; use a reviewed explicit note for a new claim.

## Retrieval and freshness

`index-memory.js`, `build-memory-context.js`, and the normal context-pack memory retrieval consume connected vault notes. Retrieval also refreshes the vault when reading an old index, so disconnecting, losing vault access, retiring a note, or changing a referenced file cannot leave stale cached vault guidance eligible.

Notes enter the existing keyword selection and context budget. They are labelled shared guidance and `verify`, even when source hashes match. They cannot grant permissions, override instructions, prove that tests passed in this checkout, or complete task acceptance criteria.

- Referenced files match: eligible shared guidance.
- Referenced files changed or are missing: withheld.
- No referenced files: eligible unverified guidance, with the origin commit and revision comparison shown.
- Same commit: informational only; it does not establish a clean working tree or current test evidence.
- Stale/superseded note or unresolved explicit conflict: withheld.
- Mirrored local/shared copies disagree: withheld until an explicit correction or publication resolves the disagreement. Shared retirement also suppresses the old local copy.
- Unavailable/invalid vault: local memory continues; cached vault notes are withheld and a diagnostic is included.

New notes are separate files, so two computers can contribute while offline. Revisions use parent IDs rather than timestamps to decide which version supersedes another. Clock order is never used to resolve competing revisions. Renaming a note does not change its identity. If a sync service produces a second file with the same note ID, resolve the duplicate before that memory family becomes eligible again. Missing revision ancestors, malformed files, unsafe links and size-limit violations are surfaced rather than silently trusted. The initial limits are 2,000 Markdown files per project, 32 KiB per note file, a 12,000-character body and 50 source dependencies per note.

## Correct or retire a note

Preserve existing generated notes and their IDs. Publish a revision with `supersedes` containing the current revision ID returned by `write` or `status`:

```json
{
  "title": "Updated portal identity decision",
  "body": "Reviewed replacement guidance and the reason for the change.",
  "supersedes": ["vm_0123456789abcdef0123456789abcdef"],
  "status": "active"
}
```

Use `status: "stale"` or `"superseded"` to retire guidance. If two devices independently revise the same note, publish an explicit resolution naming every current revision in `supersedes`. Unrelated memory families cannot be merged this way. Decisions with the same `conflict_key` and different `conflict_value` are withheld until their current revisions are corrected or retired.

Notes accept standard YAML frontmatter and ordinary Obsidian properties such as tags and aliases. The stable IDs, parents, lifecycle and source fingerprints remain required metadata. Use the writer for revisions and retirement so the history remains intact. Deleting a revision ancestor makes its remaining family incomplete and ineligible. Do not use deletion as a replacement for retirement.

## Edit notes in Obsidian

You can rename a memory note, change its display heading, and add ordinary YAML
properties such as `tags`, `aliases` and `cssclasses`. The `title` property supplies
its retrieval title. IDs and parent relationships identify revisions independently
of filenames; keep those properties and source fingerprints intact.

New notes contain a shared guidance section between
`<!-- forgeflow:memory:start -->` and `<!-- forgeflow:memory:end -->`. Put personal
comments under **Personal annotations**, outside those markers. Only the marked
body is retrieved; additional properties and annotations are excluded. Existing
pilot notes without markers retain their whole body as guidance.

The parser supports ordinary YAML scalars and lists, with bounded size and nesting.
Duplicate properties, anchors, custom tags and unsafe property names are rejected.
A damaged note whose identity can be attributed to a known family withholds that
family. Unidentifiable corruption still withholds shared project guidance because
it could conceal a retirement. `status` reports affected filenames and families
when they can be identified. Preserve history while resolving duplicate IDs or
invalid metadata.

## Recover queued publications

```sh
node scripts/forgeflow/vault-memory.js status --root /path/to/project
node scripts/forgeflow/vault-memory.js retry --root /path/to/project
```

The ignored `.forgeflow/vault-outbox/` stores publication intents with their original
revision IDs, Markdown and source hashes. `queued` means the intent remains local;
`published` confirms a local vault file. `blocked` means the connection, source
files or revision history needs review before a new publication. Retrying does not
refresh an old claim against changed source, choose between competing revisions,
or overwrite different bytes at an existing identity.

An offline explicit revision can use parent receipts previously published from this checkout. If its parent is known only on another computer, restore vault access before preparing that revision.

Use `retry` to resume an existing intent. A new explicit `write` starts a new intent.
Published receipts remain local for idempotence and ancestry recovery. Changing the
vault connection or disconnecting and reconnecting prevents pending intents from
silently being sent through the new connection. Disabling learning mirroring also
blocks automatic-learning retries. Status, retrieval and preview do not drain the
queue; no background process is required.

If a process stops immediately after creating its queue lock but before recording
the owner, an empty `.forgeflow/vault-outbox/.lock/` can remain. Confirm that no
Forgeflow publisher is running before removing that empty directory with `rmdir`,
then run `retry`. Locks with a recorded dead process are recovered automatically;
Forgeflow does not take a lock from a live or unidentified publisher.

## Leave a portable handoff

Create a curated input file containing only what the next session needs:

```json
{
  "title": "Continue the portal identity work",
  "summary": "The access boundary is documented and ready for implementation.",
  "next_steps": ["Inspect the portal authentication source before editing."],
  "blockers": ["Confirm the staff identity mapping."],
  "sources": ["src/portal/auth.ts"],
  "request_id": "portal-identity-handoff-1"
}
```

`title`, `summary` and a nonempty `next_steps` list are required. `sources` are
existing repository-relative files; the handoff includes their hashes and the
origin commit, without copying source content. `blockers` and `request_id` are
optional. Keep each text field on one line. An explicit request ID is reusable for
the same content; different content under that ID is refused.

```sh
node scripts/forgeflow/vault-memory.js handoff --root /path/to/project --input /tmp/handoff.json --dry-run
node scripts/forgeflow/vault-memory.js handoff --root /path/to/project --input /tmp/handoff.json
node scripts/forgeflow/vault-memory.js home --root /path/to/project --dry-run
node scripts/forgeflow/vault-memory.js home --root /path/to/project
```

Open `Forgeflow/Projects/<project-id>/Home.md` in Obsidian. It links memories and
handoffs and explains how to continue on another computer. The page is an explicit
snapshot; refresh it when you want updated statuses and links. Write your own
content in **Human notes**, which refresh preserves. Editing its generated section
causes refresh to refuse replacement, protecting the edited file.

Handoffs are immutable notes outside `Memories`; they are navigation and advisory
context, not automatically imported task state or test proof. Home and handoff
writes are explicit and report failures directly; the publication outbox covers
memory notes. These commands never configure Obsidian Sync or verify delivery.

## Inspect or disconnect

```sh
node scripts/forgeflow/vault-memory.js status --root /path/to/project
node scripts/forgeflow/vault-memory.js disconnect --root /path/to/project
```

`status` reports the local connection, note count, eligibility, conflicts and freshness. It does not certify Obsidian Sync completion. Disconnect removes only the local connection and preserves vault notes.

## Validation

Run `node scripts/forgeflow/test-vault-memory.js` and `node scripts/forgeflow/test-vault-usability.js`. The isolated fixture uses differently named desktop/laptop repositories, portable fingerprints, existing context-pack retrieval, stale caches, revisions, concurrent conflicts, project isolation, invalid content, unsafe filesystem links, opt-in capture and unavailable vaults. It does not exercise a paid Obsidian account or a physical second computer.

See [context intelligence](Context-Intelligence.md) for memory selection and [project learnings](Project-Learnings.md) for curated local learning capture.
