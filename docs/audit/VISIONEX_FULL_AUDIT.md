# Visionex full audit — 2026-10-17 (bounded pass)

Base: `main` @ `f8743127`. Branch: `claude/visionex-platform-audit-6157dc`.

## Coverage actually achieved
Ran: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm audit --omit=dev`; a static scan of all migrations (RLS, `SECURITY DEFINER`, permissive policies); a comparison of the two `verify_jwt` lists; a read-only header and route check of production; greps for service-role use, `dangerouslySetInnerHTML` and source maps in `src`.

**Not done** (no claim of coverage): authenticated browser journeys, admin routes, a live RLS probe, accessibility scans, Lighthouse, per-feature end-to-end checks (AI, VX, Bazaar, Academy, WhatsApp), SSH or server audit, backup restore test. Earlier audits recorded in `.claude/references/verified-findings.md` were treated as trusted context and not repeated.

## Results
| Gate | Result |
|---|---|
| typecheck (`tsc -b`) | 0 errors |
| lint (whole repo) | 3 errors before, in files CI skips (it lints changed files only); annotated; those 3 files lint clean. Whole-repo lint not re-run. 7 warnings untouched |
| tests | 6815 tests: 6805 passed, 10 failed in the loaded full run. 9 were 5 s timeouts and pass alone with `--testTimeout=60000`. 1 (`ai-route-report-workflow`) fails only on this Windows CRLF checkout; CI on Linux is green |
| build | succeeds; two ~540 kB index chunks trigger Vite's size warning |
| npm audit (prod) | 0 critical, 7 high, 38 moderate, 3 low (see Security report) |

## Findings fixed
1. **Medium — CSV formula injection** in organisation report export. Fixed and tested.
2. **Low — 3 latent ESLint errors** (intentional control-character and whitespace regexes) annotated with reasons.

## Verified non-issues
- All 630 tables created in migrations enable RLS (14 via a `DO` loop).
- The `USING (true)` "service" policies on billing and provider-hub tables were dropped by `20260829000000`.
- `search_path` set later on `billing_*` definers (`20261017000000`); the other 8 early definers without it were not individually checked.
- `verify_jwt` lists differ by design; `edge-function-jwt-lists.test.ts` enforces the dangerous direction.
- No service-role references in `src`.

## Unresolved
See the Security report (residual risks) and Roadmap.
