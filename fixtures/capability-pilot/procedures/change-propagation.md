# Change propagation

Status: evaluation cohort, version 1. Implemented for controlled evaluation; normal automatic execution awaits the roadmap pilot. Use when a shared concept, schema, identity or generated output changes. An isolated edit with no affected consumers after inspection needs no propagation work.

## Map the change

Start from the task's changed concept and authoritative files, including intended edits before a diff exists. Record the old and intended values, source revision and acceptance criteria. Search exact old/new identifiers and source paths with `rg`; inspect imports, exports, generator inputs, templates and references. Follow indirect consumers, not just literal matches. Limit each discovery pass to the affected modules and their direct consumers, expanding when an observed dependency warrants it. Record unexplored scope rather than claiming exhaustive coverage.

For branding, consider runtime UI, favicon/browser metadata, embedded documentation, screenshot capture inputs, social images and related-site cards. A screenshot filename can remain unchanged while its pixels become stale. For schemas, follow producers, parsers, serializers, imports, exports, backups, restore/migration paths and generated types. Old identifiers in migration readers or historical notes can be intentional; verify their role before replacing them.

Build an impact table in the existing task evidence, with one row per source-to-consumer relationship:

| Source and identity | Consumer and repository | Relationship | Generation/check command | Observed evidence | Status or gap |
|---|---|---|---|---|---|
| Exact file and revision/hash | Path or related-site identifier | Direct, generated, embedded or compatibility | Exact command and working directory, or manual check | Current bytes, command result or visual observation tied to source | Verified, stale, unverified or excluded with reason |

Search related repository references, but keep unavailable checkouts and external sites explicitly unverified. Discovery does not authorize editing another repository, fetching credentials, deploying or starting a service. Use existing task authorization when it does cover that work.

## Verify the consumers

Prefer the project's existing generators and drift checks. Regenerate only within authorized scope, inspect the resulting diff, and recheck each affected consumer. Record commands actually run separately from proposed commands. Do not hand-edit generated outputs as a substitute for updating their source. A missing generator leaves that edge unverified.

For bounded text references, the installed `scripts/forgeflow/check-change-propagation.js` helper can check a JSON impact manifest:

```json
{
  "schema_version": "1",
  "sources": [{"path": "assets/identity.json", "sha256": "<SHA256 of current source bytes>"}],
  "consumers": [{
    "path": "docs/guide.html",
    "sources": ["assets/identity.json"],
    "command": "node scripts/render-guide.js",
    "checks": [{"contains": "logo-current.svg"}, {"absent": "logo-retired.svg"}]
  }]
}
```

Run `node <helper-dir>/check-change-propagation.js --root <checkout> --input <manifest.json>`. The helper reads only, emits source/consumer hashes and literal-check results, and never executes the recorded command. Exit 0 means every listed consumer met its listed checks; exit 1 means stale/unverified results; exit 2 means invalid input. A consumer with `repository` set to a nonempty related-repository identifier is reported unverified without reading that path. Empty checks also remain unverified. Freeze expectations from the task requirements, not from whatever output currently exists; refresh the source hash and reassess expectations when the source changes.

Literal checks do not prove semantic compatibility, complete discovery, generated-file provenance, screenshot appearance or deployed freshness. Capture and inspect images against the current UI/source; include the source identity, capture command and artifact identity. Check favicon rendering in its actual context when required. For data changes, run a synthetic export/import and backup/restore round trip with explicit expected values and old-format policy. Merely finding a new field name in each file is insufficient.

## Close the loop

Return the impact table, commands/results, justified exclusions and remaining gaps to the existing task owner. A current result is scoped to its recorded inputs; later source or consumer changes invalidate it. Do not mark task acceptance passed while a required consumer is unverified. Remove only temporary artifacts owned by this run, stop only resources it started, and preserve the evidence. Keep model-benefit claims separate from deterministic checks.
