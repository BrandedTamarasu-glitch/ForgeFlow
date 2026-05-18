# Common Stack Examples

Use these as starting points for choosing the right Forgeflow entry command and validation checks. Adjust package manager commands to match the repo.

## Next.js Or React App

Good entry points:

```text
/discuss add keyboard navigation to the settings page
/plan implement the new billing summary panel
/review app/settings/page.tsx components/billing-summary.tsx
```

Typical validation:

```bash
npm run typecheck
npm run lint
npm test
```

Agent emphasis:

- Lumen for UX, accessibility, interaction states, and responsive layout
- Warden for auth, API calls, client/server boundaries, and validation
- Smith for data modeling and server-side logic

For UI-heavy changes, ask `/review` to include screenshots or route paths when available.

## Node API Or Express Service

Good entry points:

```text
/consult add idempotent webhook processing for Stripe events
/implement execute the webhook processing brief
/review src/routes/webhooks.ts src/services/payments.ts
```

Typical validation:

```bash
npm run typecheck
npm run lint
npm test
```

Agent emphasis:

- Warden for auth, input validation, rate limits, secrets, and external integrations
- Smith for service decomposition, database access, error handling, and testability
- Arbiter for tradeoffs when security and implementation simplicity conflict

For webhook or job processing work, explicitly mention retry behavior and idempotency in `/consult`.

## Python API

Good entry points:

```text
/research compare options for background job retries in this codebase
/plan add organization-level API keys
/review app/api_keys.py app/auth.py tests/test_api_keys.py
```

Typical validation:

```bash
pytest
ruff check .
mypy .
```

Agent emphasis:

- Warden for auth, permissions, request validation, dependency risk, and secret handling
- Smith for module boundaries, ORM usage, migrations, and test design
- Compass for requirements coverage when behavior is policy-heavy

For Django, include migrations and permission classes in the review scope. For FastAPI, include Pydantic models, dependencies, and route handlers together.

## Rails App

Good entry points:

```text
/consult add account-level audit logging
/implement execute the audit logging brief
/review app/models/audit_event.rb app/controllers/admin/users_controller.rb db/migrate
```

Typical validation:

```bash
bundle exec rspec
bundle exec rubocop
bin/rails db:migrate:status
```

Agent emphasis:

- Smith for ActiveRecord associations, migrations, callbacks, and transaction boundaries
- Warden for authorization, strong parameters, session handling, and sensitive logs
- Atlas for rollout sequencing when migrations and backfills are involved

For migrations, ask `/review` to check rollback safety, deploy order, and backfill behavior.

## Monorepo

Good entry points:

```text
/plan split the account settings work across web, api, and shared packages
/fleet --spec docs/plans/account-settings.md --shards 3
/review HEAD~4..HEAD
```

Typical validation:

```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```

Agent emphasis:

- Atlas for shard ownership, sequencing, and cross-package dependencies
- Arbiter for integration decisions between packages
- Smith, Warden, and Lumen for their domain-specific slices

For large changes, build context packets first:

```bash
scripts/forgeflow/build-context-pack.js --json
scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only
scripts/forgeflow/advise-context.js --root .forgeflow --record
```

If budget warnings appear, split the review by package or first-level directory.

## Documentation Or Config-Only Change

Good entry points:

```text
/quick update the installation docs for the new repair flag
/review README.md docs/wiki/Quick-Start.md
```

Typical validation:

```bash
node scripts/forgeflow/test-doc-links.js
git diff --check
```

Agent emphasis:

- Compass for requirement clarity and user intent
- Atlas for docs completeness and consistency
- Lumen only when the change affects user-facing UI or visual docs

Docs-only changes often route to `skip-mode` or `thin-mode`. That is expected.

## Release Prep

Before tagging Forgeflow itself:

```text
/forgeflow-release-check
```

Or run the equivalent terminal checks listed in [Demos](Demos).

For product repositories using Forgeflow, run the project’s normal tests first, then use `/review` and `/ship`.
