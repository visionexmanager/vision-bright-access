# Security report — 2026-10-17

No secrets are included. Severity: Critical / High / Medium / Low / Info.
Live checks were read-only: catalogue queries (no table rows) against the production Supabase project through the project's Supabase connector, and anonymous requests with the public publishable key.

| # | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| S1 | Medium | CSV export wrote member/org text raw; a cell beginning `=`, `+`, `-`, `@`, tab or CR runs as a formula in Excel/Sheets | `escapeCsvCell`, `src/lib/library/organizationReports.ts` | Fixed; `organization-reports-csv.test.ts` |
| S2 | Medium | `ph_get_provider_stats` (SECURITY DEFINER) returned a provider's requests, failures, **cost in USD** and latency to anyone who knew a provider id. It had the default EXECUTE grant to anon/authenticated and no caller check | Live: anonymous POST to `/rpc/ph_get_provider_stats` with an all-zero id returned HTTP 200 and the metrics object. Exploitation needs a provider UUID, which the locked-down `ph_providers` table does not reveal, hence Medium not High | Fixed in this PR: migration `20261069000000` revokes PUBLIC/anon/authenticated and grants service_role; `provider-hub` now calls it with its service-role client after the admin gate. Test: `ph-provider-stats-service-only.test.ts`. **Takes effect only when the migration deploys**; re-probe after deploy |
| S3 | Info | `xlsx@0.18.5` advisories (prototype pollution, ReDoS), no fixed release | Used only to *write* workbooks (`XLSX.write`); nothing parses untrusted files | Accepted; revisit if upload parsing is added |
| S4 | Info | `braces`, `micromatch`, `chokidar`, `fast-glob`, `tailwindcss` highs | Reached only through devDependency `tailwindcss` (build-time). `braces` 3.0.3 and `micromatch` 4.0.8 are the latest releases; fix needs Tailwind 4 | No runtime exposure; track upstream |
| S5 | Info | `source-map-js` high (event-loop DoS via crafted source map) | Build-time via PostCSS | Fixed: lockfile updated 1.2.1 → 1.2.2 (npm lockfile only). `npm audit --omit=dev`: high 7 → 6, critical 0 |
| S6 | Info | Production CSP has no `script-src` | `curl -I https://visionex.app` | Not changed; needs nonce/hash design |
| S7 | Info | Admin email preview renders admin-typed HTML via `dangerouslySetInnerHTML` (`AdminEmails.tsx:446`) | Admin-only, self-XSS | Recommend sanitising |
| S8 | Info | Supabase security linter: 5 `security_definer_view` ERRORs | Views `tv_channels_public`, `radio_stations_public`, `mobility_providers_public`, `flight_suppliers_public`, `hotel_suppliers_public` select only non-secret columns of enabled rows (read from `pg_get_viewdef`) | By design; the view owner bypass is the mechanism |
| S9 | Low | Leaked-password protection is disabled in Supabase Auth, and minimum password length is 6 | Management API read (workflow run 39052428262): `password_hibp_enabled=false`, `password_min_length=6`. Enabling attempt via `supabase-auth-hardening.yml apply` (run 39052467400) returned **HTTP 402: "available on Pro Plans and up"** | **Blocked by plan (recurring cost, needs your approval).** Mitigated at zero cost in the browser: breached-password check (HaveIBeenPwned range API, k-anonymity) on Signup and Reset Password, 20 locales, tests `pwned-password.test.ts`. A direct call to the Auth API still bypasses it; only the Pro-plan setting closes that. Re-run the workflow with mode=apply after upgrading |
| S10 | Info | 336 anon-executable SECURITY DEFINER functions (linter WARN) | I filtered to those whose body has no caller check and read the 9 that write or reveal org/provider data: `send_organization_announcement`, `invite_to_library_research_project`, the `get_organization_*` stats all raise unless `is_organization_admin` / `is_library_research_project_editor`; `run_kids_auto_moderation` is read-only | Only S2 was a defect. Revoking anon from the guarded ones would be defence in depth; not done (risk of breaking callers without per-caller proof) |

## Live results
- All 629 public tables have RLS enabled (catalogue query).
- 539 SECURITY DEFINER functions in `public`; **0 lack a pinned `search_path`** (the 11 flagged by migration text were fixed later). The 16 linter "mutable search_path" warnings are non-definer trigger/utility functions (e.g. `career_encrypt` only wraps `pgp_sym_encrypt`).
- Anonymous REST reads: `profiles`, `ph_providers`, `ph_logs`, `ph_metrics` → 401 permission denied; `user_roles`, `user_points`, `credit_wallets`, `user_subscriptions`, `credit_transactions`, `notifications`, `whatsapp_messages`, `whatsapp_conversations` → 200 with an empty array (RLS filtering). An empty array does not prove the tables hold rows; it proves nothing was returned to an anonymous caller.
- `billing_get_status` is not callable by anon (PGRST202, as the 20261017 migration intended).

## Not tested / residual
Authenticated and cross-user access (needs test accounts), Edge Function runtime authorization, webhook replay and idempotency, storage-bucket listing, rate limiting, server/SSH/firewall, GitHub branch protection and Actions permissions. I did not claim the platform is secure; these are open.
