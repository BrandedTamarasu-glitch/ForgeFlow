# Project Learnings

## Recurring Pitfalls

- Auth session changes often miss retry validation when token refresh behavior changes.

## Stable Decisions

- Keep local learning artifacts in Markdown so they remain easy to review.

## Risk Areas

- session-token-refresh: 2

## Validation Patterns

- Run auth tests and manual session renewal verification before ship.

## Recommended Approach For Next Work

- Check session-token-refresh risks before changing auth session files.
