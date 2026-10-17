# Release report — 2026-10-17

| Item | Value |
|---|---|
| PR | #427, squash-merged as `f8e77ceb` (head before merge `aec85ca9`) |
| PR checks (own head) | all passing: ESLint, Type check, Unit tests (Vitest), Tests, Security Scan, Trivy, deno check ×2, ISP management, gate SQL, "Unsubscribed callers reach no provider". GKE/image jobs skipped (not enabled) |
| Main after merge | CI, Edge Functions deno check, WhatsApp deno check, ISP CI, AMS pipeline: success |
| Deploy run `39033910785` | success: Run DB migrations, Deploy SPA → VPS, Deploy → Supabase Edge Functions (`provider-hub`) |
| Migration applied | `20261069000000_ph_provider_stats_service_only.sql` named in the migrations job log |

## Production verification (after deploy)
- Anonymous `POST /rest/v1/rpc/ph_get_provider_stats`: before HTTP 200 with the metrics object; after **HTTP 401, "permission denied for function"**.
- `https://visionex.app/` returns 200 and serves a new bundle (`index-DvBBsIOS.js`).
- axe on `/bazaar`: computed `--primary` is `172 66% 28%`; `select-name` (critical) gone; `color-contrast` 12 nodes → 1 (`#898e97` on white, 3.29:1); `nested-interactive` (1) remains.
- Not verified after deploy: the admin Provider Hub metrics screen with an admin session (no admin credentials used). It now calls the RPC with the service-role client; if it shows empty metrics, check `provider-hub` logs.

## Rollback
Revert #427 (`git revert f8e77ceb` via PR). The migration is a grant change only; to restore the old grants manually: `GRANT EXECUTE ON FUNCTION public.ph_get_provider_stats(uuid, integer) TO anon, authenticated;` (not recommended — it re-opens the leak).

## Not done
Authenticated journeys, manual screen-reader pass, Lighthouse, server audit. Owner action: enable leaked-password protection in the Supabase dashboard.

## Addendum — follow-up PRs
- #428 (squash `b1986997`): this report + `supabase-auth-hardening.yml` (manual; plan/apply).
- Workflow `plan` run `39052428262`: success; HIBP off, min length 6. `apply` run `39052467400`: **failed with HTTP 402** (Pro plan required); no setting was changed.
- Password-policy PR (browser-side breached-password check): see its PR description for the checks and deploy run.
