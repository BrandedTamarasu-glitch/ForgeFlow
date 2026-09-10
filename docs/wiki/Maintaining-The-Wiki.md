# Maintaining The Wiki

The canonical Markdown lives in `docs/wiki/` in the ForgeFlow source repository. GitHub serves the wiki from a separate `ForgeFlow.wiki.git` repository. A push to the product repository does not update the published wiki automatically.

## Keep The Surfaces Aligned

Edit the source pages first. Keep current setup and workflow instructions separate from historical release evidence. Update the [Home](Home.md) topic index and sidebar when adding a page. Link to other source pages with `.md` extensions; use relative repository paths for images and other documentation.

The local exporter converts page links to GitHub wiki routes and repository assets to absolute GitHub URLs. Images use raw image URLs. HTML guides and changelogs link to their GitHub file pages, where readers can download them. GitHub Pages is not assumed to be enabled.

## Prepare A Local Export

From the ForgeFlow source checkout:

```bash
node scripts/forgeflow/test-doc-links.js
node scripts/forgeflow/test-release-version.js
node scripts/forgeflow/test-export-wiki.js
```

Clone the published wiki into a separate directory outside the source checkout. Choose a new path, or use an existing clean wiki checkout after inspecting its status and fetching current changes.

```bash
git clone https://github.com/BrandedTamarasu-glitch/ForgeFlow.wiki.git /path/to/ForgeFlow.wiki
git -C /path/to/ForgeFlow.wiki status --short
node scripts/export-wiki.js --out /path/to/ForgeFlow.wiki
git -C /path/to/ForgeFlow.wiki diff --stat
node scripts/export-wiki.js --out /path/to/ForgeFlow.wiki --check
```

The exporter writes local Markdown only. It preserves `.git` and unrelated assets, rejects unexpected wiki-only Markdown pages so they can be reconciled explicitly, and never commits, pushes, or deletes pages. `--check` reports drift without writing. Review the full diff and check the Home page, sidebar, guide/PDF links, and dashboard image before publishing.

## Publish And Verify

Publish only when a maintainer has authorized the repository and wiki changes. Commit and push the source documentation first so exported links resolve to the corresponding files on `main`. Then stage the reviewed Markdown files by name in the wiki checkout, commit them, and push that separate repository. Do not stage private audit notes or local workflow state.

After publishing as part of an authorized release, verify the GitHub wiki Home page, sidebar, a setup page, the dashboard image, and both guide links. Compare the published wiki HEAD with the local commit and rerun the exporter with `--check`. Run source validation locally; GitHub Actions is disabled for the product repository. Local checks do not prove the published wiki's rendered links work.

If someone has edited the wiki directly, bring useful changes back into `docs/wiki/` before the next export. Do not overwrite an unexplained remote edit. Keep [Release Process](Release-Process.md), the README, the documentation entry, and the wiki consistent when the product changes.
