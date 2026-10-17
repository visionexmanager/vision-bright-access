# Security report — 2026-10-17

No secrets are included. Severity: Critical / High / Medium / Low / Info.

| # | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| S1 | Medium | CSV export wrote member/org text raw; a cell beginning `=`, `+`, `-`, `@`, tab or CR executes as a formula in Excel/Sheets | `escapeCsvCell` in `src/lib/library/organizationReports.ts` | Fixed; `src/test/organization-reports-csv.test.ts` (3 tests) |
| S2 | Info | `xlsx@0.18.5` has unfixable advisories (prototype pollution, ReDoS) | Used only to *write* workbooks (`XLSX.write`); nothing parses untrusted files. XLSX string cells starting `=` are stored as text | Accepted; reconsider if upload parsing is added |
| S3 | Info | 6 other high advisories (`braces`, `micromatch`, `chokidar`, `fast-glob`, `source-map-js`, `tailwindcss`) | All build-time tooling chains | No runtime exposure; track upstream |
| S4 | Info | Production CSP has no `script-src` (only framing/base/object/form rules) | `curl -I https://visionex.app` | Not changed: a script policy needs a nonce/hash design and could break the app. Roadmap item |
| S5 | Info | Admin email preview uses `dangerouslySetInnerHTML` on HTML the admin types (`AdminEmails.tsx:446`) | Admin-only route, self-XSS | Recommend sanitising; not changed |
| S6 | Info | `config.toml` lists 13 JWT-exempt functions, deploy script 19 | Intentional, tested | None |

Headers seen on production: HSTS (1 year, no `includeSubDomains`), nosniff, X-Frame-Options SAMEORIGIN, strict-origin-when-cross-origin, Permissions-Policy.

## Residual risk / not tested
Live RLS behaviour as anon/authenticated, Edge Function runtime authorization, webhook replay/idempotency, storage policies, rate limiting, server/SSH/firewall, GitHub branch protection and Actions permissions. These were not exercised in this pass.
