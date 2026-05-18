# Friction To Fix

Use this playbook after field validation reveals repeated first-run friction. The goal is to turn observed problems into small fixes in the right layer.

## Triage Rule

Create a fix when the same friction appears in at least two trials, or when one trial blocks first review entirely.

Classify each issue by the first layer that could have prevented it:

| Category | Fix Layer | Examples |
|---|---|---|
| `install` | updater, manifest, permissions docs | managed file missing, helper not executable, download failed |
| `health` | `/forgeflow-health`, health helper | status unclear, false pass, missing exact remediation |
| `settings` | health diagnostics, docs | hook or statusline wiring confusion |
| `template-installer` | `install-template.js`, install docs | wrong Codex destination, unclear dry-run output |
| `codex-discovery` | Codex docs, installer verification | agents copied but not visible after restart |
| `agent-routing` | route helper, review docs | wrong review mode, missing specialist |
| `context-budget` | budget defaults, advisor, examples | repeated over-budget packets or low-savings packets |
| `review-quality` | reviewer prompts, routing docs, examples | findings lack evidence, repeated false positives, unclear severity |
| `docs` | quick start, branch trial, examples | user needed to search for the next step |

## Fix Shape

Prefer the smallest fix that would have prevented the repeated friction:

- For unclear output, improve the diagnostic message before adding new tooling.
- For repeated manual mistakes, add an exact command or snippet to docs.
- For missing files, update the install manifest and its tests.
- For Codex discovery issues, improve dry-run output or first-run verification.
- For context-budget issues, add an example, adjust recommendations, or tune defaults only with evidence.

## Validation

Every fix should include one of these:

- a focused helper test
- a docs link test
- a release-check addition
- a reproducible manual field-validation note

Run the smallest relevant checks, then include the command names in the commit or PR notes.

## Close The Loop

After the fix:

1. Re-run the failed first-run path.
2. Update the local friction log with the fix category and result.
3. Generate or update a public-safe summary if review quality was affected.
4. Move the repeated issue from "observed" to "fixed" in local field-validation notes.

Do not commit raw field-validation logs unless the project explicitly wants them versioned.

Use [Support Triage](Support-Triage) for the first response path during team trials.
