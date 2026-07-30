# Visionex AI Development Instructions

These rules apply to every AI coding agent working in this repository.

## Project context

- Product: Visionex, a multilingual global platform.
- Repository: `visionexmanager/vision-bright-access`.
- Default branch: `main`.
- Production site: `https://visionex.app`.
- Stack: Vite, React, TypeScript, Supabase, GitHub Actions, and a VPS deployment webhook.
- The primary user is blind. Preserve keyboard navigation, screen-reader semantics, focus behavior, accessible names, and clear error/status announcements.

## Required workflow

1. Start from the latest `origin/main`.
2. Never commit or push directly to `main`.
3. Use a focused branch with an `agent/`, `codex/`, or `claude/` prefix.
4. Keep each change scoped to the user's request. Do not modify unrelated user work.
5. Run the relevant validation before opening a pull request.
6. Open a pull request into `main`; do not merge until required checks pass.
7. Production deployment runs automatically only after CI succeeds on `main`.

## Validation

For application changes, run at minimum:

```bash
npm ci
npx tsc --noEmit
npm test
npm run lint
npm run build
```

If a repository check is intentionally narrower, explain why in the pull request. Add or update tests for behavior changes. Do not claim success without reporting the commands actually run and their results.

## Supabase

- Treat `supabase/config.toml`, migrations, Edge Functions, and generated database types as production-sensitive.
- Add schema changes as new timestamped migration files; never rewrite migration history that may already be deployed.
- Make migrations idempotent and preserve existing data.
- Review row-level security, authentication, storage policies, and service-role boundaries for every database change.
- Never expose service-role keys, database passwords, access tokens, webhook secrets, or private credentials in code, logs, commits, issues, or chat.
- Client-side code may use only the public Supabase URL and publishable/anon key.
- Confirm migrations and Edge Functions deploy successfully through GitHub Actions after merge.

## Deployment and CI

- Do not bypass, weaken, or remove the CI gate.
- Do not manually deploy untested commits.
- Preserve manual `workflow_dispatch` as a recovery path.
- Changes to `.github/workflows/`, deployment scripts, VPS hooks, or `infra/stream-proxy/` require explicit validation and a clear pull-request explanation.
- Treat warnings separately from failures, but record important deprecations for follow-up.

## Accessibility and internationalization

- All interactive controls must be reachable and usable with a keyboard.
- Preserve visible focus indicators, logical focus order, semantic HTML, accessible labels, and screen-reader announcements.
- Never rely only on color, icons, hover, drag-and-drop, or pointer interaction.
- Preserve right-to-left behavior and Arabic translations; add English and Arabic copy for new user-facing text unless the feature defines broader language coverage.
- Keep error messages actionable and status changes announced appropriately.

## Security and product integrity

- Prefer legal, licensed, or officially provided content and streams.
- Validate external URLs and untrusted input.
- Do not weaken authorization, billing, KYC, payment, rate-limit, or anti-abuse controls to make a test pass.
- Preserve atomic VX balance operations and safe refund behavior.
- Do not invent production data, credentials, deployment results, or test outcomes.

## Collaboration

- Before editing, inspect the current branch, working tree, relevant files, and recent changes.
- If another agent or the user has overlapping uncommitted work, stop and resolve the overlap instead of overwriting it.
- Use concise commit messages and pull-request descriptions that state what changed, why, user impact, validation, and deployment considerations.
- When handing off, report the branch, commit, pull request, checks, deployment state, and any remaining risk.
