# Commit Hygiene Rules (opt-in per project + enforced by Forgeflow /ship)

Opt-in by adding this line to a project's `CLAUDE.md`:
```
@~/.claude/project-rules/commit-hygiene.md
```

The Forgeflow's `/ship` command validates these rules automatically before pushing. Local opt-in additionally surfaces them during `/commit` guidance and review.

---

## Commit Body Line Length
Keep commit message body lines **≤ 72 characters**. Pre-commit hooks on many projects reject longer lines. The subject line may exceed 72 but keep it ≤ 70 where possible.

Offending pattern to avoid — single long paragraph:
```
This commit changes the authentication flow to use a new token format that includes additional claims and a shorter expiry window.
```

Correct — wrapped at 72:
```
This commit changes the authentication flow to use a new token
format that includes additional claims and a shorter expiry
window.
```

## Prettier Before Staging
If the project has prettier configured, format staged files before commit:
```bash
pnpm prettier --write <staged-files>
git add <same-files>
```
The global PostToolUse hook already formats on Edit/Write, but a final pass before commit catches anything the hook missed (files edited by tools that don't trigger the hook, files with conflicting formats after merge).

## Stale Imports After Removal
After removing an export from a module, grep for consumers and clean up their imports in the SAME commit:
```bash
# After deleting `export function foo()`:
grep -rn "import.*foo" src/ --include="*.ts" --include="*.tsx"
```
Untouched stale imports compile fine today but break the next build after someone renames or removes the consuming file. Fix them in the commit that introduced the removal.

## Never Commit
- `.env` files (even if the values look safe)
- Files matching `*.key`, `*.pem`, `*.p12`, `*.cert`
- Files named `*secret*`, `*password*`, `*token*` unless explicitly project-vetted
- Debug output files: `*.log`, `coverage/`, `.nyc_output/`, `dist/` (unless gitignored)
- IDE config unless shared team config: `.vscode/settings.json` private overrides, `.idea/` private

Pre-commit: run `git status` and audit each file by name before staging. Never `git add .` or `git add -A`.

## Commit Scope
One logical change per commit. If the diff spans unrelated concerns (bug fix + refactor + unrelated doc update), split into separate commits before push. Makes `git bisect` useful and PR review cleaner.

## Message Format (project-level override possible)
Default to conventional-commit style:
- `feat:` — new user-facing capability
- `fix:` — bug fix
- `refactor:` — code restructuring, no behavior change
- `chore:` — tooling, dependencies, scripts
- `docs:` — documentation only
- `test:` — test additions or fixes

Scope in parens when useful: `feat(auth): ...`
