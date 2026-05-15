# Forgeflow Sync Config Schema

Configuration file at `.forgeflow/<project>/config.json` that enables team shared state sync via `/forgeflow-sync`. When present, `/forgeflow-sync --push` and `/forgeflow-sync --pull` use this file to locate the remote forgeflow-state repo and identify the current user.

Running `/forgeflow-sync --init` creates this file interactively. It is project-scoped — multiple projects in the same repo each have their own config under `.forgeflow/<project>/`.

---

## Config Fields

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `remote_url` | string | yes | — | GitHub HTTPS or SSH URL of the forgeflow-state repo |
| `strategy` | enum | yes | — | Sync transport strategy. Only `"git-v1"` in V1 |
| `sync_branch` | string | no | `"main"` | Branch to push/pull from in the remote repo. Reserved for V2 — always `main` in V1. The command does not read this field. |
| `team_members` | array of objects | no | `[]` | Each entry: `{ "username": string, "display_name": string }` |

---

## Example config.json

```json
{
  "remote_url": "https://github.com/org/forgeflow-state-myproject",
  "strategy": "git-v1",
  "sync_branch": "main",
  "team_members": [
    { "username": "user", "display_name": "Atlas Ebert" }
  ]
}
```

---

## Username Resolution Convention

The current user's identity is resolved from `team_members[0].username` in `config.json`.

When `config.json` is absent or `team_members` is empty, the resolved username is `"local"`.

This username is used in two places:

- `agent-notes/<agent>-<user>.md` — per-user, per-agent note file naming (e.g., `agent-notes/warden-user.md`)
- `source_user` field in `learnings.jsonl` entries — identifies which team member produced the learning

---

## learnings.jsonl Schema

Standard entry shape, extended with an optional `source_user` field:

```json
{
  "date": "2026-04-20",
  "source": "warden",
  "type": "security|efficiency|quality|ux|pattern",
  "learning": "max 30 words",
  "files": ["relevant/file.ts"],
  "severity": "high|medium|low",
  "source_user": "user"
}
```

`source_user` is optional. Omit it when `/forgeflow-sync --init` has not been run. Agents must not require its presence — any consumer of `learnings.jsonl` must handle entries where `source_user` is absent.

---

## Security Constraints

These constraints are enforced by `/forgeflow-sync` before any git operation.

### URL Validation

`remote_url` must use one of these schemes:

- `https://` — GitHub HTTPS
- `git://` — git protocol
- `git@` — SSH

Credential-embedded URLs are rejected outright. Example of a rejected URL:

```
https://user:pass@github.com/org/forgeflow-state-myproject
```

`/forgeflow-sync --init` will not write a config containing a credential-embedded URL. If the URL is modified manually to embed credentials, `/forgeflow-sync` will abort on the next run.

### Gitignore Gate

`/forgeflow-sync --init` checks that `.forgeflow/` is listed in `.gitignore` as its first step. This check is blocking — init will not proceed until the entry is present. This prevents Forgeflow state (agent notes, learnings, config) from being committed to the project repo.

### Remote URL Mismatch Abort

If `config.remote_url` differs from the URL returned by `git remote get-url forgeflow-state`, `/forgeflow-sync --push` aborts with an error before touching any remote. This prevents accidental pushes to the wrong repo when the remote has drifted from the config.

---

## V1 Limitations

- **JSONL dedup is full-line string match only.** Two `learnings.jsonl` entries with identical content but different field ordering are treated as distinct entries and both will be retained after a pull. V5.1 will add JSON parse + field-order normalization for dedup comparison.
- **`agent-notes/` is per-user and never synced.** Push/pull operations do not touch `agent-notes/`. Each team member's notes remain local to their machine.

---

## Migration

### agent-notes file renaming

Existing installs using the legacy `agent-notes/<agent-name>.md` naming require no manual migration. Each atlas agent reads the legacy filename as a fallback and renames the file to the new `agent-notes/<agent>-<user>.md` convention on its next write. No action required.

### learnings.jsonl

`source_user` is an additive optional field. Existing entries without it are valid and will continue to be read correctly. Agents must not require its presence. New entries written after `/forgeflow-sync --init` is run will include `source_user` automatically.

### V1 JSONL dedup limitation

The union merge algorithm in `--pull` uses full-line string comparison. Two entries with identical semantic content but different JSON field ordering are treated as distinct and will both be retained. This is a known V1 limitation. V5.1 will add JSON parse + field-order normalization before dedup comparison.
