---
name: testing
description: Which Visionex check to run, when, and in what order — targeted tests during development and the full gate only at the end. Load before running any verification, and whenever tempted to run the whole suite again.
---

# Testing

## The order

1. Identify the smallest test that can fail for this change. Usually one file in
   `src/test/`, named after the area.
2. Run it. Fix what it reports.
3. Keep developing. Re-run that one file.
4. Run the full suite once, at final verification.
5. Do not run the full suite after every small change, and do not rerun a check
   that just passed on unchanged code.

`npm test` is 155 files and about three minutes. One file is seconds. The
difference, repeated twenty times in a session, is the session.

## The checks, and when each applies

| Check | Run it when |
| --- | --- |
| `npx vitest run <file>` | Always — the inner loop. |
| `npm run typecheck` | Any TypeScript change. It is `tsc -b`; a bare `tsc --noEmit` checks nothing in this repository and always passes. |
| `npm run lint` | Before finishing, on anything under `src/`. |
| `deno check --no-lock --node-modules-dir=none <file>` | Any `supabase/functions/_shared/*.ts`. The flag is required. |
| PGlite run | Any migration, before it ships. See the `supabase` skill. |
| `npm run build` | Anything that could affect the bundle. |
| `npm test` | Final verification only. |

Run the checks the change actually implies. A migration needs no bundle; a CSS
change needs no PGlite.

This is about *ordering*, not about skipping. `AGENTS.md` requires typecheck,
the full suite, lint and build before an application change is finished, and
that still holds — it is the outer loop, run once, not after every edit. A
narrower final gate has to be explained in the pull request.

## Writing the test

6. Prove the defect first. A regression test that passes before the fix is
   testing nothing.
7. Pin behaviour a person can observe, not the shape of the implementation.
8. Re-run a new guard against the broken code once. A guard that cannot fail is
   not a guard, and this repository has shipped two.
9. Never weaken a security or accessibility assertion to make a test pass.
10. Never report a result you did not see. If a check could not run, say which
    and why.

## Known noise

`src/test/whatsapp-business-profile.test.ts` fails to load on a Windows checkout
— line endings, not your change; it passes in CI. Occasional flakes under full
parallelism re-run clean; confirm before treating one as a regression.

Depth: `test-engineer` for strategy and coverage design.
