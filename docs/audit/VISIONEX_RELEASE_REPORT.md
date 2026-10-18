# Release report

## Merged and deployed (verified against GitHub records on 2026-10-17)
| PR | Merge commit | Merged (UTC) | Deploy evidence |
|---|---|---|---|
| #427 fix: CSV injection, provider-stats cost leak, AA contrast, labelled Bazaar selects, audit reports | `f8e77ceb` | 12:43 | Deploy run `39033910785` success — Run DB migrations (`20261069000000_ph_provider_stats_service_only.sql` applied), Deploy SPA → VPS, Deploy Edge Functions (`provider-hub`) |
| #428 release report + manual `Supabase Auth hardening` workflow | `b1986997` | 17:07 | CI green; workflow `plan` run 39052428262 succeeded |
| #429 breached-password check, accessible password error | `f7265be2` | 17:25 | Deploy success; live bundle contains the check; HaveIBeenPwned reachable from the site origin |
| #430 phase-2/3 assessment, DR report, risks, matrix, roadmap, guides | open | — | docs only; CI green on the previous head |

## Post-deploy production checks performed (read-only)
- Anonymous `POST /rest/v1/rpc/ph_get_provider_stats`: before HTTP 200 with metrics; after HTTP 401 "permission denied for function". Catalogue: anon=false, authenticated=false, service_role=true.
- `https://visionex.app/` 200; served bundle changed; computed `--primary` = `172 66% 28%`.
- axe on `/bazaar`: `select-name` gone; contrast 12 nodes → 1; `nested-interactive` 1 remains.
- Lighthouse (2026-10-17, mobile preset, run from the owner's PC, one run per route): home 32 / services 49 / library 40 / pricing 29 / signup 48 / bazaar 39 performance; accessibility 95–97; SEO 100. Details and caveats: `VISIONEX_REMAINING_RISKS.md` §3.

## Not performed
Authenticated journeys, admin Provider Hub smoke, live payment flows, server probe, backup/restore (no backup exists), manual screen-reader run.

## Rollback
Reverting a merge means a revert PR through CI (`deploy.yml` deploys `main` only). The #427 migration is a grant change; the old grants can be restored with `GRANT EXECUTE ON FUNCTION public.ph_get_provider_stats(uuid, integer) TO anon, authenticated;` — not recommended (it re-opens the cost leak). Full rollback runbook is task T-A7.

## Recurring costs introduced by any of the above
None. Pending decisions that *would* add cost are listed in `VISIONEX_PRODUCT_ROADMAP.md` ("Approvals required").
