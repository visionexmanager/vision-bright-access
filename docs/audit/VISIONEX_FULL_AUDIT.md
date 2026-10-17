# Visionex full audit — 2026-10-17

Base `main` @ `f8743127`; PR #427 on branch `claude/visionex-platform-audit-6157dc`. Detail: Security, UX/Accessibility, Performance, Feature matrix, Roadmap and Release reports in this folder.

## Coverage
Ran: `npm ci`, typecheck, whole-repo lint, full Vitest, production build, `npm audit`; static scan of all migrations; **live read-only checks on production** (catalogue queries, Supabase security linter, anonymous REST/RPC probes); axe-core on 12 public routes; Performance API on `/`; header and route check.
**Not done:** authenticated and cross-user tests, admin routes, manual screen-reader/keyboard runs, Lighthouse, per-feature end-to-end journeys, Edge Function runtime auth, webhook replay tests, server/SSH audit, backup restore. No claim of full coverage is made.

## Local results (final tree, Windows/Node 24)
| Check | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors, 7 warnings (pre-existing) |
| `npm test` | 6822 passed, 2 failed of 6824. `whatsapp-business-profile` hit a 5 s timeout under load and passes alone (15/15). `ai-route-report-workflow` fails only on this CRLF checkout |
| `npm run build` | succeeds (run before the last edits; CI builds the final head) |
| `npm audit --omit=dev` | 0 critical, 6 high, 38 moderate, 3 low |

## Findings and fixes (all in PR #427)
1. Medium — CSV formula injection in report export. Fixed + test.
2. Medium — `ph_get_provider_stats` exposed provider cost to anonymous callers (live-confirmed). Fixed by migration + edge-function change + test; effective on deploy.
3. WCAG AA contrast failures on every public route (primary teal, footer headings). Fixed + test.
4. Critical axe `select-name` on `/bazaar` (ten selects). Fixed + test.
5. Three latent ESLint errors annotated; `source-map-js` lockfile bump.

## Unresolved / owner action
Leaked-password protection is off (dashboard toggle — yours). Remaining a11y items, CLS 0.254 / LCP 3.3 s on home, six unfixable build-time dependency advisories, CSP without `script-src`. See Roadmap.
